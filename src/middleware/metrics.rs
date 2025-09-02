use crate::AppState;
use axum::{extract::State, http::Request, middleware, response::Response};
use axum_prometheus::PrometheusMetricLayer;
use prometheus::{Counter, Encoder, Gauge, Histogram, HistogramOpts, Registry, TextEncoder};
use std::collections::HashMap;
use std::sync::Arc;
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::{Duration, Instant};
use sysinfo::System;
use tokio::sync::RwLock;

#[derive(Clone)]
pub struct MetricsState {
    pub registry: Arc<Registry>,
    pub request_counter: Counter,
    pub request_duration: Histogram,
    pub request_duration_microseconds: Histogram,
    pub slow_requests_counter: Counter,
    pub active_connections: Gauge,
    pub database_connections: Gauge,
    pub http2_connections: Gauge,
    pub tls_connections: Gauge,
    pub compression_requests_total: Counter,
    pub custom_metrics: Arc<RwLock<HashMap<String, Counter>>>,
    pub cpu_cache_hundredths: Arc<AtomicU64>,
    pub cpu_usage_gauge: Gauge,
}

impl MetricsState {
    pub fn new() -> Result<Self, Box<dyn std::error::Error>> {
        let registry = Arc::new(Registry::new());

        let request_counter = Counter::new("http_requests_total", "Total number of HTTP requests")?;

        let request_duration = Histogram::with_opts(HistogramOpts::new(
            "http_request_duration_seconds",
            "HTTP request duration in seconds",
        ))?;

        let request_duration_microseconds = Histogram::with_opts(
            HistogramOpts::new(
                "http_request_duration_microseconds",
                "HTTP request duration in microseconds",
            )
            .buckets(vec![
                100.0, 500.0, 1000.0, 5000.0, 10000.0, 50000.0, 100000.0, 500000.0, 1000000.0,
            ]),
        )?;

        let slow_requests_counter = Counter::new(
            "http_slow_requests_total",
            "Total number of slow HTTP requests (>100ms)",
        )?;

        let active_connections = Gauge::new(
            "websocket_active_connections",
            "Number of active WebSocket connections",
        )?;

        let database_connections = Gauge::new(
            "database_connections_active",
            "Number of active database connections",
        )?;

        let http2_connections = Gauge::new(
            "http2_connections_active",
            "Number of active HTTP/2 connections",
        )?;

        let tls_connections =
            Gauge::new("tls_connections_active", "Number of active TLS connections")?;

        let cpu_usage_gauge = Gauge::new(
            "system_cpu_usage_percent",
            "Estimated system CPU usage percentage (0-100)",
        )?;

        let compression_requests_total = Counter::new(
            "http_compression_requests_total",
            "Total number of HTTP requests with compression applied",
        )?;

        if !cfg!(test) {
            registry.register(Box::new(request_counter.clone()))?;
            registry.register(Box::new(request_duration.clone()))?;
            registry.register(Box::new(request_duration_microseconds.clone()))?;
            registry.register(Box::new(slow_requests_counter.clone()))?;
            registry.register(Box::new(active_connections.clone()))?;
            registry.register(Box::new(database_connections.clone()))?;
            registry.register(Box::new(http2_connections.clone()))?;
            registry.register(Box::new(tls_connections.clone()))?;
            registry.register(Box::new(cpu_usage_gauge.clone()))?;
            registry.register(Box::new(compression_requests_total.clone()))?;
        }

        Ok(MetricsState {
            registry,
            request_counter,
            request_duration,
            request_duration_microseconds,
            slow_requests_counter,
            active_connections,
            database_connections,
            http2_connections,
            tls_connections,
            compression_requests_total,
            custom_metrics: Arc::new(RwLock::new(HashMap::new())),
            cpu_cache_hundredths: Arc::new(AtomicU64::new(0)),
            cpu_usage_gauge,
        })
    }

    pub fn start_cpu_sampler(&self) {
        let cache = self.cpu_cache_hundredths.clone();
        let gauge = self.cpu_usage_gauge.clone();

        tokio::spawn(async move {
            let mut sys = System::new_all();
            loop {
                sys.refresh_cpu_all();
                tokio::time::sleep(Duration::from_millis(100)).await;
                sys.refresh_cpu_all();

                let cpus = sys.cpus();
                let value_percent = if cpus.is_empty() {
                    0.0
                } else {
                    let total: f32 = cpus.iter().map(|c| c.cpu_usage()).sum();
                    (total / cpus.len() as f32) as f64
                } as f64;

                let hundredths = (value_percent * 100.0).round().clamp(0.0, 10000.0) as u64;
                cache.store(hundredths, Ordering::Relaxed);
                gauge.set(value_percent);

                tokio::time::sleep(Duration::from_secs(1)).await;
            }
        });
    }

    pub fn get_cached_cpu_usage_percent(&self) -> f64 {
        (self.cpu_cache_hundredths.load(Ordering::Relaxed) as f64) / 100.0
    }

    pub fn update_database_connections(&self, pool: &crate::database::DatabasePool) {
        let state = pool.state();
        self.database_connections.set(state.connections as f64);
    }

    pub async fn get_metrics(&self) -> Result<String, Box<dyn std::error::Error>> {
        let encoder = TextEncoder::new();
        let metric_families = self.registry.gather();
        let mut buffer = Vec::new();
        encoder.encode(&metric_families, &mut buffer)?;
        Ok(String::from_utf8(buffer)?)
    }

    pub async fn increment_custom_metric(
        &self,
        name: &str,
        help: &str,
    ) -> Result<(), Box<dyn std::error::Error>> {
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

    pub fn record_compression(&self) {
        self.compression_requests_total.inc();
    }
}

pub fn setup_metrics_layer() -> PrometheusMetricLayer<'static> {
    let (prometheus_layer, _) = PrometheusMetricLayer::pair();
    prometheus_layer
}

pub async fn metrics_middleware(
    State(app_state): State<AppState>,
    request: Request<axum::body::Body>,
    next: middleware::Next,
) -> Response {
    let start = Instant::now();
    let method = request.method().clone();
    let uri = request.uri().path().to_string();

    app_state.metrics_state.request_counter.inc();

    let response = next.run(request).await;
    let status = response.status();

    if let Some(content_encoding) = response.headers().get("content-encoding") {
        if let Ok(encoding) = content_encoding.to_str() {
            if encoding.contains("gzip") || encoding.contains("br") || encoding.contains("deflate") {
                app_state.metrics_state.compression_requests_total.inc();
                
                tracing::debug!(
                    "Compression applied: encoding={}, path={}",
                    encoding, uri
                );
            }
        }
    }

    let duration = start.elapsed();
    let duration_micros = duration.as_micros() as f64;
    let duration_seconds = duration.as_secs_f64();

    app_state
        .metrics_state
        .request_duration
        .observe(duration_seconds);
    app_state
        .metrics_state
        .request_duration_microseconds
        .observe(duration_micros);

    if duration_micros > 100_000.0 {
        app_state.metrics_state.slow_requests_counter.inc();
        tracing::warn!(
            "Slow request detected: {} {} - {:.2}ms (status: {})",
            method,
            uri,
            duration_micros / 1000.0,
            status
        );
    }

    tracing::debug!(
        "Request {} {} completed in {:.0}μs ({:.3}ms) - status: {}",
        method,
        uri,
        duration_micros,
        duration_micros / 1000.0,
        status
    );

    response
}
