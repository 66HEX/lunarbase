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
            SubscriptionType::Query { filters: subscription_filters } => {
                // Check if the event data matches the subscription filters
                self.matches_filters(&event.event, subscription_filters)
            }
        }
    }

    // Check if a record event matches the specified filters
    fn matches_filters(&self, event: &RecordEvent, filters: &HashMap<String, String>) -> bool {
        // Extract record data from the event
        let record_data = match event {
            RecordEvent::Created { record, .. } => Some(record),
            RecordEvent::Updated { record, .. } => Some(record),
            RecordEvent::Deleted { old_record, .. } => old_record.as_ref(),
        };

        // If no record data is available, don't match
        let record_data = match record_data {
            Some(data) => data,
            None => return false,
        };

        // Check each filter against the record data
        for (field_name, filter_expr) in filters {
            if !self.check_field_filter(record_data, field_name, filter_expr) {
                return false;
            }
        }

        true
    }

    // Check if a specific field matches a filter expression
    // Filter format: "operator:value" (e.g., "eq:active", "gt:100", "like:test%")
    fn check_field_filter(&self, record_data: &serde_json::Value, field_name: &str, filter_expr: &str) -> bool {
        let field_value = match record_data.get(field_name) {
            Some(value) => value,
            None => return false, // Field doesn't exist in record
        };

        // Parse the filter expression (operator:value)
        let parts: Vec<&str> = filter_expr.splitn(2, ':').collect();
        if parts.len() != 2 {
            return false; // Invalid filter format
        }

        let operator = parts[0];
        let filter_value = parts[1];

        match operator {
            "eq" => self.compare_values_eq(field_value, filter_value),
            "ne" => !self.compare_values_eq(field_value, filter_value),
            "gt" => self.compare_values_gt(field_value, filter_value),
            "gte" => self.compare_values_gte(field_value, filter_value),
            "lt" => self.compare_values_lt(field_value, filter_value),
            "lte" => self.compare_values_lte(field_value, filter_value),
            "like" => self.compare_values_like(field_value, filter_value),
            "notlike" => !self.compare_values_like(field_value, filter_value),
            "in" => self.compare_values_in(field_value, filter_value),
            "notin" => !self.compare_values_in(field_value, filter_value),
            "isnull" => field_value.is_null(),
            "isnotnull" => !field_value.is_null(),
            _ => false, // Unknown operator
        }
    }

    // Helper methods for value comparison
    fn compare_values_eq(&self, field_value: &serde_json::Value, filter_value: &str) -> bool {
        match field_value {
            serde_json::Value::String(s) => s == filter_value,
            serde_json::Value::Number(n) => {
                if let Ok(filter_num) = filter_value.parse::<f64>() {
                    n.as_f64().map_or(false, |v| v == filter_num)
                } else {
                    false
                }
            }
            serde_json::Value::Bool(b) => {
                filter_value.parse::<bool>().map_or(false, |filter_bool| *b == filter_bool)
            }
            _ => false,
        }
    }

    fn compare_values_gt(&self, field_value: &serde_json::Value, filter_value: &str) -> bool {
        match field_value {
            serde_json::Value::Number(n) => {
                if let Ok(filter_num) = filter_value.parse::<f64>() {
                    n.as_f64().map_or(false, |v| v > filter_num)
                } else {
                    false
                }
            }
            serde_json::Value::String(s) => s.as_str() > filter_value,
            _ => false,
        }
    }

    fn compare_values_gte(&self, field_value: &serde_json::Value, filter_value: &str) -> bool {
        match field_value {
            serde_json::Value::Number(n) => {
                if let Ok(filter_num) = filter_value.parse::<f64>() {
                    n.as_f64().map_or(false, |v| v >= filter_num)
                } else {
                    false
                }
            }
            serde_json::Value::String(s) => s.as_str() >= filter_value,
            _ => false,
        }
    }

    fn compare_values_lt(&self, field_value: &serde_json::Value, filter_value: &str) -> bool {
        match field_value {
            serde_json::Value::Number(n) => {
                if let Ok(filter_num) = filter_value.parse::<f64>() {
                    n.as_f64().map_or(false, |v| v < filter_num)
                } else {
                    false
                }
            }
            serde_json::Value::String(s) => s.as_str() < filter_value,
            _ => false,
        }
    }

    fn compare_values_lte(&self, field_value: &serde_json::Value, filter_value: &str) -> bool {
        match field_value {
            serde_json::Value::Number(n) => {
                if let Ok(filter_num) = filter_value.parse::<f64>() {
                    n.as_f64().map_or(false, |v| v <= filter_num)
                } else {
                    false
                }
            }
            serde_json::Value::String(s) => s.as_str() <= filter_value,
            _ => false,
        }
    }

    fn compare_values_like(&self, field_value: &serde_json::Value, filter_value: &str) -> bool {
        if let serde_json::Value::String(s) = field_value {
            // Simple pattern matching - % as wildcard
            if filter_value.contains('%') {
                let pattern = filter_value.replace('%', ".*");
                if let Ok(regex) = regex::Regex::new(&format!("^{}$", pattern)) {
                    return regex.is_match(s);
                }
            }
            // Fallback to substring matching
            s.contains(filter_value)
        } else {
            false
        }
    }

    fn compare_values_in(&self, field_value: &serde_json::Value, filter_value: &str) -> bool {
        let values: Vec<&str> = filter_value.split(',').collect();
        match field_value {
            serde_json::Value::String(s) => values.contains(&s.as_str()),
            serde_json::Value::Number(n) => {
                if let Some(num_val) = n.as_f64() {
                    values.iter().any(|v| {
                        v.parse::<f64>().map_or(false, |parsed| parsed == num_val)
                    })
                } else {
                    false
                }
            }
            _ => false,
        }
    }
}