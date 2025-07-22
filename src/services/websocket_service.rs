use axum::extract::ws::{Message, WebSocket};
use futures_util::{SinkExt, StreamExt};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::{RwLock, broadcast, mpsc};
use tracing::{debug, error, info, warn};
use uuid::Uuid;
use chrono::{DateTime, Utc};
use serde_json::json;

use crate::models::{
    ClientConnection, EventMessage, PendingEvent, Permission, SubscriptionConfirmed,
    SubscriptionData, SubscriptionError, SubscriptionRequest, UnsubscribeRequest, WebSocketMessage,
};
use crate::services::PermissionService;
use crate::utils::AuthError;

pub type ConnectionId = Uuid;
pub type SubscriptionId = String;

#[derive(Clone)]
pub struct WebSocketService {
    // Active connections: ConnectionId -> (sender, client_info, connected_at)
    connections: Arc<
        RwLock<HashMap<ConnectionId, (mpsc::UnboundedSender<WebSocketMessage>, ClientConnection, DateTime<Utc>)>>,
    >,
    // Event broadcaster
    event_sender: broadcast::Sender<PendingEvent>,
    // Permission service for access control
    permission_service: Arc<PermissionService>,
    // Activity log (limited to last 1000 entries)
    activity_log: Arc<RwLock<Vec<ActivityLogEntry>>>,
}

#[derive(Debug, Clone)]
pub struct ActivityLogEntry {
    pub timestamp: DateTime<Utc>,
    pub connection_id: ConnectionId,
    pub user_id: Option<i32>,
    pub action: String,
    pub details: Option<String>,
}

impl WebSocketService {
    pub fn new(permission_service: Arc<PermissionService>) -> Self {
        let (event_sender, _) = broadcast::channel(1000);

        Self {
            connections: Arc::new(RwLock::new(HashMap::new())),
            event_sender,
            permission_service,
            activity_log: Arc::new(RwLock::new(Vec::new())),
        }
    }

    /// Handle new WebSocket connection
    pub async fn handle_connection(self: Arc<Self>, socket: WebSocket, user_id: Option<i32>) {
        let connection_id = Uuid::new_v4();
        let mut client_connection = ClientConnection::new(user_id);
        client_connection.connection_id = connection_id;

        info!(
            "New WebSocket connection: {} (user: {:?})",
            connection_id, user_id
        );

        let (mut sender, mut receiver) = socket.split();
        let (tx, mut rx) = mpsc::unbounded_channel::<WebSocketMessage>();

        let connected_at = Utc::now();
        
        // Store connection
        {
            let mut connections = self.connections.write().await;
            connections.insert(connection_id, (tx, client_connection.clone(), connected_at));
        }
        
        // Log connection activity
        self.log_activity(
            connection_id,
            user_id,
            "connected".to_string(),
            Some(format!("User ID: {:?}", user_id)),
        ).await;

        // Subscribe to events
        let mut event_receiver = self.event_sender.subscribe();
        let connections_clone = self.connections.clone();
        let permission_service = self.permission_service.clone();

        // Task for sending messages to client
        let send_task = tokio::spawn(async move {
            while let Some(message) = rx.recv().await {
                let json_message = match serde_json::to_string(&message) {
                    Ok(json) => json,
                    Err(e) => {
                        error!("Failed to serialize message: {}", e);
                        continue;
                    }
                };

                if sender
                    .send(Message::Text(json_message.into()))
                    .await
                    .is_err()
                {
                    debug!("Client disconnected during send");
                    break;
                }
            }
        });

        // Task for receiving events and routing to appropriate clients
        let event_task = tokio::spawn(async move {
            while let Ok(event) = event_receiver.recv().await {
                let connections = connections_clone.read().await;

                for (conn_id, (sender, client, _)) in connections.iter() {
                    // Find matching subscriptions for this event
                    for (sub_id, sub_data) in &client.subscriptions {
                        if sub_data.matches_event(&event) {
                            // Check permissions
                            if let Some(sub_user_id) = sub_data.user_id {
                                // Get user and collection for permission check
                                let mut conn = match permission_service.pool.get() {
                                    Ok(conn) => conn,
                                    Err(_) => continue,
                                };

                                // Get user object
                                use crate::models::User;
                                use crate::schema::users;
                                use diesel::prelude::*;
                                let user =
                                    match users::table.find(sub_user_id).first::<User>(&mut conn) {
                                        Ok(user) => user,
                                        Err(_) => continue,
                                    };

                                // Get collection ID
                                use crate::models::Collection;
                                use crate::schema::collections;
                                let collection = match collections::table
                                    .filter(collections::name.eq(&event.collection_name))
                                    .first::<Collection>(&mut conn)
                                {
                                    Ok(collection) => collection,
                                    Err(_) => continue,
                                };

                                let has_permission = permission_service
                                    .check_collection_permission(
                                        &user,
                                        collection.id,
                                        Permission::Read,
                                    )
                                    .await
                                    .unwrap_or(false);

                                if !has_permission {
                                    debug!(
                                        "User {} lacks permission for collection {}",
                                        sub_user_id, event.collection_name
                                    );
                                    continue;
                                }
                            }

                            let event_message = EventMessage {
                                subscription_id: sub_id.clone(),
                                collection_name: event.collection_name.clone(),
                                event: event.event.clone(),
                            };

                            if sender.send(WebSocketMessage::Event(event_message)).is_err() {
                                debug!("Failed to send event to connection {}", conn_id);
                            }
                        }
                    }
                }
            }
        });

        // Handle incoming messages from client
        while let Some(msg) = receiver.next().await {
            match msg {
                Ok(Message::Text(text)) => {
                    if let Err(e) = self.handle_client_message(connection_id, &text).await {
                        warn!("Error handling client message: {}", e);
                    }
                }
                Ok(Message::Close(_)) => {
                    info!("Client {} disconnected", connection_id);
                    break;
                }
                Ok(Message::Ping(_data)) => {
                    let connections = self.connections.read().await;
                    if let Some((sender, _, _)) = connections.get(&connection_id) {
                        let _ = sender.send(WebSocketMessage::Pong);
                    }
                }
                Err(e) => {
                    error!("WebSocket error: {}", e);
                    break;
                }
                _ => {}
            }
        }

        // Log disconnection activity
        self.log_activity(
            connection_id,
            user_id,
            "disconnected".to_string(),
            None,
        ).await;
        
        // Cleanup connection
        {
            let mut connections = self.connections.write().await;
            connections.remove(&connection_id);
        }

        // Cancel tasks
        send_task.abort();
        event_task.abort();

        info!("WebSocket connection {} closed", connection_id);
    }

    /// Handle incoming client message
    async fn handle_client_message(
        &self,
        connection_id: ConnectionId,
        text: &str,
    ) -> Result<(), AuthError> {
        let message: WebSocketMessage = serde_json::from_str(text)
            .map_err(|_| AuthError::ValidationError(vec!["Invalid JSON message".to_string()]))?;

        match message {
            WebSocketMessage::Subscribe(req) => {
                self.handle_subscribe(connection_id, req).await?;
            }
            WebSocketMessage::Unsubscribe(req) => {
                self.handle_unsubscribe(connection_id, req).await?;
            }
            WebSocketMessage::Ping => {
                let connections = self.connections.read().await;
                if let Some((sender, _, _)) = connections.get(&connection_id) {
                    let _ = sender.send(WebSocketMessage::Pong);
                }
            }
            _ => {
                warn!("Unexpected message type from client");
            }
        }

        Ok(())
    }

    /// Handle subscription request
    async fn handle_subscribe(
        &self,
        connection_id: ConnectionId,
        req: SubscriptionRequest,
    ) -> Result<(), AuthError> {
        let mut connections = self.connections.write().await;

        if let Some((sender, client, _)) = connections.get_mut(&connection_id) {
            // Check permissions if user is authenticated
            if let Some(user_id) = client.user_id {
                // Get user and collection for permission check
                let mut conn = self
                    .permission_service
                    .pool
                    .get()
                    .map_err(|_| AuthError::InternalError)?;

                use crate::models::{Collection, User};
                use crate::schema::{collections, users};
                use diesel::prelude::*;

                let user = users::table
                    .find(user_id)
                    .first::<User>(&mut conn)
                    .map_err(|_| AuthError::InternalError)?;

                let collection = collections::table
                    .filter(collections::name.eq(&req.collection_name))
                    .first::<Collection>(&mut conn)
                    .map_err(|_| AuthError::NotFound("Collection not found".to_string()))?;

                let has_permission = self
                    .permission_service
                    .check_collection_permission(&user, collection.id, Permission::Read)
                    .await
                    .map_err(|_| AuthError::InternalError)?;

                if !has_permission {
                    let error_msg = SubscriptionError {
                        subscription_id: req.subscription_id.clone(),
                        error: "Insufficient permissions".to_string(),
                    };
                    let _ = sender.send(WebSocketMessage::SubscriptionError(error_msg));
                    return Err(AuthError::Forbidden("Insufficient permissions".to_string()));
                }
            }

            // Create subscription data
            let sub_data = SubscriptionData::new(
                req.collection_name.clone(),
                req.subscription_type.clone(),
                req.filters.clone(),
                client.user_id,
            );

            // Add subscription to client
            client.add_subscription(req.subscription_id.clone(), sub_data);

            // Send confirmation
            let confirmation = SubscriptionConfirmed {
                subscription_id: req.subscription_id,
                collection_name: req.collection_name,
                subscription_type: req.subscription_type,
            };
            let _ = sender.send(WebSocketMessage::SubscriptionConfirmed(confirmation));

            info!("Added subscription for connection {}", connection_id);
        }

        Ok(())
    }

    /// Handle unsubscribe request
    async fn handle_unsubscribe(
        &self,
        connection_id: ConnectionId,
        req: UnsubscribeRequest,
    ) -> Result<(), AuthError> {
        let mut connections = self.connections.write().await;

        if let Some((_sender, client, _)) = connections.get_mut(&connection_id) {
            client.remove_subscription(&req.subscription_id);
            info!(
                "Removed subscription {} for connection {}",
                req.subscription_id, connection_id
            );
        }

        Ok(())
    }

    /// Broadcast event to all relevant subscribers
    pub async fn broadcast_event(&self, event: PendingEvent) -> Result<(), AuthError> {
        debug!(
            "Broadcasting event for collection: {}",
            event.collection_name
        );

        if let Err(e) = self.event_sender.send(event) {
            error!("Failed to broadcast event: {}", e);
            return Err(AuthError::InternalError);
        }

        Ok(())
    }

    /// Get number of active connections
    pub async fn connection_count(&self) -> usize {
        let connections = self.connections.read().await;
        connections.len()
    }

    /// Get number of active subscriptions
    pub async fn subscription_count(&self) -> usize {
        let connections = self.connections.read().await;
        connections
            .values()
            .map(|(_, client, _)| client.subscriptions.len())
            .sum()
    }

    /// Get connection statistics
    pub async fn get_stats(&self) -> WebSocketStats {
        let connections = self.connections.read().await;
        let mut subscriptions_by_collection: HashMap<String, usize> = HashMap::new();
        let mut authenticated_connections = 0;

        for (_, client, _) in connections.values() {
            if client.user_id.is_some() {
                authenticated_connections += 1;
            }

            for sub_data in client.subscriptions.values() {
                *subscriptions_by_collection
                    .entry(sub_data.collection_name.clone())
                    .or_insert(0) += 1;
            }
        }

        WebSocketStats {
            total_connections: connections.len(),
            authenticated_connections,
            total_subscriptions: connections
                .values()
                .map(|(_, client, _)| client.subscriptions.len())
                .sum(),
            subscriptions_by_collection,
        }
    }

    /// Get detailed connection information
    pub async fn get_connection_details(&self) -> Vec<crate::handlers::websocket::ConnectionDetails> {
        use crate::handlers::websocket::{ConnectionDetails, SubscriptionInfo};
        
        let connections = self.connections.read().await;
        let mut details = Vec::new();

        for (conn_id, (_, client, connected_at)) in connections.iter() {
            let subscriptions = client.subscriptions.iter().map(|(sub_id, sub_data)| {
                let subscription_type = match &sub_data.subscription_type {
                    crate::models::SubscriptionType::Collection => "collection".to_string(),
                    crate::models::SubscriptionType::Record { record_id } => format!("record:{}", record_id),
                    crate::models::SubscriptionType::Query { .. } => "query".to_string(),
                };
                
                SubscriptionInfo {
                    subscription_id: sub_id.clone(),
                    collection_name: sub_data.collection_name.clone(),
                    subscription_type,
                    filters: sub_data.filters.clone(),
                }
            }).collect();

            details.push(ConnectionDetails {
                connection_id: conn_id.to_string(),
                user_id: client.user_id,
                connected_at: connected_at.to_rfc3339(),
                subscriptions,
            });
        }

        details
    }

    /// Disconnect a specific connection
    pub async fn disconnect_connection(&self, connection_id: ConnectionId) -> bool {
        let mut connections = self.connections.write().await;
        
        if let Some((sender, client, _)) = connections.get(&connection_id) {
            // Log disconnection activity
            self.log_activity(
                connection_id,
                client.user_id,
                "force_disconnected".to_string(),
                Some("Disconnected by admin".to_string()),
            ).await;
            
            // Send close message to trigger cleanup
            let _ = sender.send(crate::models::WebSocketMessage::Event(
                crate::models::EventMessage {
                    subscription_id: "system".to_string(),
                    collection_name: "system".to_string(),
                    event: crate::models::RecordEvent::Created {
                        record_id: "disconnect".to_string(),
                        record: json!({"reason": "disconnected_by_admin"}),
                    },
                }
            ));
            
            connections.remove(&connection_id);
            true
        } else {
            false
        }
    }

    /// Broadcast admin message to connections
    pub async fn broadcast_admin_message(
        &self,
        message: &str,
        target_users: Option<&Vec<i32>>,
        target_collections: Option<&Vec<String>>,
    ) -> usize {
        let connections = self.connections.read().await;
        let mut sent_count = 0;

        for (conn_id, (sender, client, _)) in connections.iter() {
            let mut should_send = true;

            // Filter by target users if specified
            if let Some(target_users) = target_users {
                if let Some(user_id) = client.user_id {
                    should_send = target_users.contains(&user_id);
                } else {
                    should_send = false; // Anonymous users excluded when targeting specific users
                }
            }

            // Filter by target collections if specified
             if should_send {
                 if let Some(target_collections) = target_collections {
                     should_send = client.subscriptions.values().any(|sub| {
                         target_collections.contains(&sub.collection_name)
                     });
                 }
             }

            if should_send {
                let admin_message = crate::models::WebSocketMessage::Event(
                    crate::models::EventMessage {
                        subscription_id: "admin_broadcast".to_string(),
                        collection_name: "system".to_string(),
                        event: crate::models::RecordEvent::Created {
                            record_id: "admin_message".to_string(),
                            record: json!({
                                "type": "admin_message",
                                "message": message,
                                "timestamp": Utc::now().to_rfc3339()
                            }),
                        },
                    }
                );

                if sender.send(admin_message).is_ok() {
                    sent_count += 1;
                    
                    // Log broadcast activity
                    self.log_activity(
                        *conn_id,
                        client.user_id,
                        "admin_message_received".to_string(),
                        Some(format!("Message: {}", message)),
                    ).await;
                }
            }
        }

        sent_count
    }

    /// Get activity log
    pub async fn get_activity_log(&self, limit: usize, offset: usize) -> crate::handlers::websocket::ActivityResponse {
        use crate::handlers::websocket::{ActivityEntry, ActivityResponse};
        
        let activity_log = self.activity_log.read().await;
        let total_count = activity_log.len();
        
        let activities = activity_log
            .iter()
            .rev() // Most recent first
            .skip(offset)
            .take(limit)
            .map(|entry| ActivityEntry {
                timestamp: entry.timestamp.to_rfc3339(),
                connection_id: entry.connection_id.to_string(),
                user_id: entry.user_id,
                action: entry.action.clone(),
                details: entry.details.clone(),
            })
            .collect();

        ActivityResponse {
            activities,
            total_count,
        }
    }

    /// Log activity (internal method)
    async fn log_activity(
        &self,
        connection_id: ConnectionId,
        user_id: Option<i32>,
        action: String,
        details: Option<String>,
    ) {
        let mut activity_log = self.activity_log.write().await;
        
        let entry = ActivityLogEntry {
            timestamp: Utc::now(),
            connection_id,
            user_id,
            action,
            details,
        };
        
        activity_log.push(entry);
        
        // Keep only last 1000 entries
        if activity_log.len() > 1000 {
            activity_log.remove(0);
        }
    }
}

#[derive(Debug, serde::Serialize, utoipa::ToSchema)]
pub struct WebSocketStats {
    pub total_connections: usize,
    pub authenticated_connections: usize,
    pub total_subscriptions: usize,
    pub subscriptions_by_collection: HashMap<String, usize>,
}
