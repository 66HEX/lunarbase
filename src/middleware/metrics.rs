use axum::Router;
use axum_prometheus::PrometheusMetricLayer;
use prometheus::{Encoder, TextEncoder, Registry, Counter, Histogram, Gauge, HistogramOpts};
use std::sync::Arc;
use tokio::sync::RwLock;
use std::collections::HashMap;

#[derive(Clone)]
pub struct MetricsState {
    pub registry: Arc<Registry>,
    pub request_counter: Counter,
    pub request_duration: Histogram,
    pub active_connections: Gauge,
    pub database_connections: Gauge,
    pub custom_metrics: Arc<RwLock<HashMap<String, Counter>>>,
}

impl MetricsState {
    pub fn new() -> Result<Self, Box<dyn std::error::Error>> {
        let registry = Arc::new(Registry::new());
        
        // Create standard metrics
        let request_counter = Counter::new(
            "http_requests_total",
            "Total number of HTTP requests"
        )?;
        
        let request_duration = Histogram::with_opts(
            HistogramOpts::new(
                "http_request_duration_seconds",
                "HTTP request duration in seconds"
            )
        )?;
        
        let active_connections = Gauge::new(
            "websocket_active_connections",
            "Number of active WebSocket connections"
        )?;
        
        let database_connections = Gauge::new(
            "database_connections_active",
            "Number of active database connections"
        )?;
        
        // Register metrics only if not in test environment
        // In tests, we skip registration to avoid global recorder conflicts
        if !cfg!(test) {
            registry.register(Box::new(request_counter.clone()))?;
            registry.register(Box::new(request_duration.clone()))?;
            registry.register(Box::new(active_connections.clone()))?;
            registry.register(Box::new(database_connections.clone()))?;
        }
        
        Ok(MetricsState {
            registry,
            request_counter,
            request_duration,
            active_connections,
            database_connections,
            custom_metrics: Arc::new(RwLock::new(HashMap::new())),
        })
    }
    
    pub async fn get_metrics(&self) -> Result<String, Box<dyn std::error::Error>> {
        let encoder = TextEncoder::new();
        let metric_families = self.registry.gather();
        let mut buffer = Vec::new();
        encoder.encode(&metric_families, &mut buffer)?;
        Ok(String::from_utf8(buffer)?)
    }
    
    pub async fn increment_custom_metric(&self, name: &str, help: &str) -> Result<(), Box<dyn std::error::Error>> {
        let mut metrics = self.custom_metrics.write().await;
        
        if !metrics.contains_key(name) {
            let counter = Counter::new(name, help)?;
            self.registry.register(Box::new(counter.clone()))?;
            metrics.insert(name.to_string(), counter);
        }
        
        if let Some(counter) = metrics.get(name) {
            counter.inc();
        }
        
        Ok(())
    }
}

pub fn setup_metrics_layer() -> PrometheusMetricLayer<'static> {
    // In tests, we might get "Failed to set global recorder" error
    // This is expected behavior when running multiple tests
    let (prometheus_layer, _) = PrometheusMetricLayer::pair();
    prometheus_layer
}

pub fn add_metrics_middleware(router: Router, _metrics_state: MetricsState) -> Router {
    // Skip metrics middleware in test environment to avoid global recorder conflicts
    if cfg!(test) {
        return router;
    }
    
    let (prometheus_layer, _) = PrometheusMetricLayer::pair();
    
    router
        .layer(prometheus_layer)
}