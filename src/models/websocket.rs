use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", content = "data")]
pub enum WebSocketMessage {
    // Client -> Server messages
    Subscribe(SubscriptionRequest),
    Unsubscribe(UnsubscribeRequest),
    Ping,
    
    // Server -> Client messages  
    SubscriptionConfirmed(SubscriptionConfirmed),
    SubscriptionError(SubscriptionError),
    Event(EventMessage),
    Pong,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SubscriptionRequest {
    pub subscription_id: String,
    pub collection_name: String,
    pub subscription_type: SubscriptionType,
    pub filters: Option<HashMap<String, String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UnsubscribeRequest {
    pub subscription_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SubscriptionConfirmed {
    pub subscription_id: String,
    pub collection_name: String,
    pub subscription_type: SubscriptionType,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SubscriptionError {
    pub subscription_id: String,
    pub error: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum SubscriptionType {
    // Subscribe to all record changes in collection
    Collection,
    // Subscribe to specific record changes
    Record { record_id: String },
    // Subscribe to records matching filters
    Query { filters: HashMap<String, String> },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EventMessage {
    pub subscription_id: String,
    pub collection_name: String,
    pub event: RecordEvent,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "action")]
pub enum RecordEvent {
    Created {
        record_id: String,
        record: serde_json::Value,
    },
    Updated {
        record_id: String,
        record: serde_json::Value,
        old_record: Option<serde_json::Value>,
    },
    Deleted {
        record_id: String,
        old_record: Option<serde_json::Value>,
    },
}

// Internal structures for connection management
#[derive(Debug, Clone)]
pub struct ClientConnection {
    pub user_id: Option<i32>,
    pub connection_id: Uuid,
    pub subscriptions: HashMap<String, SubscriptionData>,
}

#[derive(Debug, Clone)]
pub struct SubscriptionData {
    pub collection_name: String,
    pub subscription_type: SubscriptionType,
    pub filters: Option<HashMap<String, String>>,
    pub user_id: Option<i32>, // For permission checking
}

#[derive(Debug, Clone)]
pub struct PendingEvent {
    pub collection_name: String,
    pub event: RecordEvent,
    pub user_id: Option<i32>, // User who triggered the event
}

impl ClientConnection {
    pub fn new(user_id: Option<i32>) -> Self {
        Self {
            user_id,
            connection_id: Uuid::new_v4(),
            subscriptions: HashMap::new(),
        }
    }

    pub fn add_subscription(&mut self, subscription_id: String, data: SubscriptionData) {
        self.subscriptions.insert(subscription_id, data);
    }

    pub fn remove_subscription(&mut self, subscription_id: &str) -> Option<SubscriptionData> {
        self.subscriptions.remove(subscription_id)
    }

    pub fn get_subscription(&self, subscription_id: &str) -> Option<&SubscriptionData> {
        self.subscriptions.get(subscription_id)
    }
}

impl SubscriptionData {
    pub fn new(
        collection_name: String,
        subscription_type: SubscriptionType,
        filters: Option<HashMap<String, String>>,
        user_id: Option<i32>,
    ) -> Self {
        Self {
            collection_name,
            subscription_type,
            filters,
            user_id,
        }
    }

    // Check if this subscription should receive an event
    pub fn matches_event(&self, event: &PendingEvent) -> bool {
        // First check if collection matches
        if self.collection_name != event.collection_name {
            return false;
        }

        match &self.subscription_type {
            SubscriptionType::Collection => true,
            SubscriptionType::Record { record_id } => {
                match &event.event {
                    RecordEvent::Created { record_id: event_record_id, .. } |
                    RecordEvent::Updated { record_id: event_record_id, .. } |
                    RecordEvent::Deleted { record_id: event_record_id, .. } => {
                        record_id == event_record_id
                    }
                }
            }
            SubscriptionType::Query { filters: _subscription_filters } => {
                // TODO: Implement filter matching logic
                // For now, match all events in the collection
                true
            }
        }
    }
} 