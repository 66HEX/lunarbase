use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::{broadcast, RwLock, mpsc};
use axum::extract::ws::{Message, WebSocket};
use uuid::Uuid;
use futures_util::{SinkExt, StreamExt};
use tracing::{info, warn, error, debug};

use crate::models::{
    WebSocketMessage, SubscriptionRequest, UnsubscribeRequest, SubscriptionConfirmed,
    SubscriptionError, EventMessage, ClientConnection, SubscriptionData, PendingEvent,
    Permission
};
use crate::services::PermissionService;
use crate::utils::AuthError;

pub type ConnectionId = Uuid;
pub type SubscriptionId = String;

#[derive(Clone)]
pub struct WebSocketService {
    // Active connections: ConnectionId -> (sender, client_info)
    connections: Arc<RwLock<HashMap<ConnectionId, (mpsc::UnboundedSender<WebSocketMessage>, ClientConnection)>>>,
    // Event broadcaster
    event_sender: broadcast::Sender<PendingEvent>,
    // Permission service for access control
    permission_service: Arc<PermissionService>,
}

impl WebSocketService {
    pub fn new(permission_service: Arc<PermissionService>) -> Self {
        let (event_sender, _) = broadcast::channel(1000);
        
        Self {
            connections: Arc::new(RwLock::new(HashMap::new())),
            event_sender,
            permission_service,
        }
    }

    /// Handle new WebSocket connection
    pub async fn handle_connection(self: Arc<Self>, socket: WebSocket, user_id: Option<i32>) {
        let connection_id = Uuid::new_v4();
        let mut client_connection = ClientConnection::new(user_id);
        client_connection.connection_id = connection_id;

        info!("New WebSocket connection: {} (user: {:?})", connection_id, user_id);

        let (mut sender, mut receiver) = socket.split();
        let (tx, mut rx) = mpsc::unbounded_channel::<WebSocketMessage>();

        // Store connection
        {
            let mut connections = self.connections.write().await;
            connections.insert(connection_id, (tx, client_connection));
        }

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

                if sender.send(Message::Text(json_message.into())).await.is_err() {
                    debug!("Client disconnected during send");
                    break;
                }
            }
        });

        // Task for receiving events and routing to appropriate clients
        let event_task = tokio::spawn(async move {
            while let Ok(event) = event_receiver.recv().await {
                let connections = connections_clone.read().await;
                
                for (conn_id, (sender, client)) in connections.iter() {
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
                                use diesel::prelude::*;
                                use crate::schema::users;
                                use crate::models::User;
                                let user = match users::table.find(sub_user_id).first::<User>(&mut conn) {
                                    Ok(user) => user,
                                    Err(_) => continue,
                                };
                                
                                // Get collection ID
                                use crate::schema::collections;
                                use crate::models::Collection;
                                let collection = match collections::table
                                    .filter(collections::name.eq(&event.collection_name))
                                    .first::<Collection>(&mut conn) {
                                    Ok(collection) => collection,
                                    Err(_) => continue,
                                };
                                
                                let has_permission = permission_service
                                    .check_collection_permission(&user, collection.id, Permission::Read)
                                    .await
                                    .unwrap_or(false);

                                if !has_permission {
                                    debug!("User {} lacks permission for collection {}", sub_user_id, event.collection_name);
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
                    if let Some((sender, _)) = connections.get(&connection_id) {
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
    async fn handle_client_message(&self, connection_id: ConnectionId, text: &str) -> Result<(), AuthError> {
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
                if let Some((sender, _)) = connections.get(&connection_id) {
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
    async fn handle_subscribe(&self, connection_id: ConnectionId, req: SubscriptionRequest) -> Result<(), AuthError> {
        let mut connections = self.connections.write().await;
        
        if let Some((sender, client)) = connections.get_mut(&connection_id) {
            // Check permissions if user is authenticated
            if let Some(user_id) = client.user_id {
                // Get user and collection for permission check
                let mut conn = self.permission_service.pool.get()
                    .map_err(|_| AuthError::InternalError)?;
                
                use diesel::prelude::*;
                use crate::schema::{users, collections};
                use crate::models::{User, Collection};
                
                let user = users::table.find(user_id).first::<User>(&mut conn)
                    .map_err(|_| AuthError::InternalError)?;
                
                let collection = collections::table
                    .filter(collections::name.eq(&req.collection_name))
                    .first::<Collection>(&mut conn)
                    .map_err(|_| AuthError::NotFound("Collection not found".to_string()))?;
                
                let has_permission = self.permission_service
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
    async fn handle_unsubscribe(&self, connection_id: ConnectionId, req: UnsubscribeRequest) -> Result<(), AuthError> {
        let mut connections = self.connections.write().await;
        
        if let Some((_sender, client)) = connections.get_mut(&connection_id) {
            client.remove_subscription(&req.subscription_id);
            info!("Removed subscription {} for connection {}", req.subscription_id, connection_id);
        }

        Ok(())
    }

    /// Broadcast event to all relevant subscribers
    pub async fn broadcast_event(&self, event: PendingEvent) -> Result<(), AuthError> {
        debug!("Broadcasting event for collection: {}", event.collection_name);
        
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
        connections.values()
            .map(|(_, client)| client.subscriptions.len())
            .sum()
    }

    /// Get connection statistics
    pub async fn get_stats(&self) -> WebSocketStats {
        let connections = self.connections.read().await;
        let mut subscriptions_by_collection: HashMap<String, usize> = HashMap::new();
        let mut authenticated_connections = 0;

        for (_, client) in connections.values() {
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
            total_subscriptions: connections.values()
                .map(|(_, client)| client.subscriptions.len())
                .sum(),
            subscriptions_by_collection,
        }
    }
}

#[derive(Debug, serde::Serialize)]
pub struct WebSocketStats {
    pub total_connections: usize,
    pub authenticated_connections: usize,
    pub total_subscriptions: usize,
    pub subscriptions_by_collection: HashMap<String, usize>,
} 