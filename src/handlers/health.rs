use crate::AppState;
use axum::{extract::State, http::StatusCode, response::Json};
use diesel::prelude::*;
use serde_json::{Value, json};
use std::sync::OnceLock;
use std::time::SystemTime;
use sysinfo::System;
use utoipa::ToSchema;

static APP_START_TIME: OnceLock<SystemTime> = OnceLock::new();

#[derive(serde::Serialize, ToSchema)]
pub struct HealthResponse {
    pub status: String,
    pub message: String,
    pub timestamp: String,
    pub version: String,
    pub uptime: u64,
    pub database: DatabaseHealth,
    pub memory: MemoryInfo,
    pub system: SystemInfo,
}

#[derive(serde::Serialize, ToSchema)]
pub struct DatabaseHealth {
    pub status: String,
    pub connection_pool_size: u32,
    pub active_connections: u32,
    pub total_collections: i64,
    pub total_records: i64,
}

#[derive(serde::Serialize, ToSchema)]
pub struct MemoryInfo {
    pub used_mb: f64,
    pub total_mb: f64,
    pub usage_percentage: f64,
}

#[derive(serde::Serialize, ToSchema)]
pub struct SystemInfo {
    pub cpu_usage: f64,
    pub load_average: f64,
    pub disk_usage_percentage: f64,
}

/// Enhanced health check endpoint with detailed system information
#[utoipa::path(
    get,
    path = "/health/admin",
    tag = "Health",
    responses(
        (status = 200, description = "Service is healthy with detailed system information", body = HealthResponse,
            example = json!({
                "status": "healthy",
                "message": "LunarBase health check",
                "timestamp": "2024-01-15T10:30:00Z",
                "version": "0.1.0",
                "uptime": 3600,
                "database": {
                    "status": "healthy",
                    "connection_pool_size": 10,
                    "active_connections": 2,
                    "total_collections": 5,
                    "total_records": 1250
                },
                "memory": {
                    "used_mb": 256.5,
                    "total_mb": 8192.0,
                    "usage_percentage": 3.13
                },
                "system": {
                    "cpu_usage": 15.2,
                    "load_average": 0.8,
                    "disk_usage_percentage": 45.0
                }
            })
        ),
        (status = 503, description = "Service is unhealthy", body = Value)
    ),
    security(
        ("bearer_auth" = [])
    )
)]
pub async fn health_check(
    State(state): State<AppState>,
) -> Result<(StatusCode, Json<Value>), StatusCode> {
    // Initialize app start time if not already set
    APP_START_TIME.get_or_init(|| SystemTime::now());

    // Check database health
    let database_health = check_database_health(&state).await;
    let memory_info = get_memory_info();
    let system_info = get_system_info();

    let is_healthy = database_health.status == "healthy";
    let status_code = if is_healthy {
        StatusCode::OK
    } else {
        StatusCode::SERVICE_UNAVAILABLE
    };

    let response = HealthResponse {
        status: if is_healthy {
            "healthy".to_string()
        } else {
            "unhealthy".to_string()
        },
        message: "LunarBase health check".to_string(),
        timestamp: chrono::Utc::now().to_rfc3339(),
        version: env!("CARGO_PKG_VERSION").to_string(),
        uptime: get_uptime_seconds(),
        database: database_health,
        memory: memory_info,
        system: system_info,
    };

    Ok((status_code, Json(serde_json::to_value(response).unwrap())))
}

/// Public health check endpoint without database dependency
#[utoipa::path(
    get,
    path = "/health",
    tag = "Health",
    responses(
        (status = 200, description = "Service is healthy with system information", body = Value,
            example = json!({
                "status": "healthy",
                "message": "LunarBase is running",
                "timestamp": "2024-01-15T10:30:00Z",
                "version": "0.1.0",
                "uptime": 3600,
                "memory": {
                    "used_mb": 256.5,
                    "total_mb": 8192.0,
                    "usage_percentage": 3.13
                },
                "system": {
                    "cpu_usage": 15.2,
                    "load_average": 0.8,
                    "disk_usage_percentage": 45.0
                }
            })
        ),
        (status = 503, description = "Service is unhealthy", body = Value)
    )
)]
pub async fn public_health_check() -> Result<(StatusCode, Json<Value>), StatusCode> {
    // Initialize app start time if not already set
    APP_START_TIME.get_or_init(|| SystemTime::now());

    let memory_info = get_memory_info();
    let system_info = get_system_info();

    let response = json!({
        "status": "healthy",
        "message": "LunarBase is running",
        "timestamp": chrono::Utc::now().to_rfc3339(),
        "version": env!("CARGO_PKG_VERSION"),
        "uptime": get_uptime_seconds(),
        "memory": {
            "used_mb": memory_info.used_mb,
            "total_mb": memory_info.total_mb,
            "usage_percentage": memory_info.usage_percentage
        },
        "system": {
            "cpu_usage": system_info.cpu_usage,
            "load_average": system_info.load_average,
            "disk_usage_percentage": system_info.disk_usage_percentage
        }
    });

    Ok((StatusCode::OK, Json(response)))
}

/// Simple health check endpoint for load balancers
#[utoipa::path(
    get,
    path = "/health/simple",
    tag = "Health",
    responses(
        (status = 200, description = "Basic health status for load balancers", body = Value,
            example = json!({
                "status": "ok",
                "timestamp": "2024-01-15T10:30:00Z"
            })
        ),
        (status = 503, description = "Service is unhealthy", body = Value)
    )
)]
pub async fn simple_health_check() -> Result<(StatusCode, Json<Value>), StatusCode> {
    let response = json!({
        "status": "ok",
        "timestamp": chrono::Utc::now().to_rfc3339()
    });

    Ok((StatusCode::OK, Json(response)))
}

async fn check_database_health(state: &AppState) -> DatabaseHealth {
    match state.db_pool.get() {
        Ok(mut conn) => {
            // Test database connection with a simple query
            match diesel::sql_query("SELECT 1").execute(&mut conn) {
                Ok(_) => {
                    // Get collection count
                    let collections_count =
                        match diesel::sql_query("SELECT COUNT(*) as count FROM collections")
                            .load::<CountResult>(&mut conn)
                        {
                            Ok(results) => results.first().map(|r| r.count).unwrap_or(0),
                            Err(_) => 0,
                        };

                    // Estimate total records (this is approximate)
                    let total_records = estimate_total_records(&mut conn);

                    // Get real pool state information
                    let pool_state = state.db_pool.state();

                    DatabaseHealth {
                        status: "healthy".to_string(),
                        connection_pool_size: pool_state.connections + pool_state.idle_connections,
                        active_connections: pool_state.connections,
                        total_collections: collections_count,
                        total_records,
                    }
                }
                Err(_) => {
                    let pool_state = state.db_pool.state();
                    DatabaseHealth {
                        status: "unhealthy".to_string(),
                        connection_pool_size: pool_state.connections + pool_state.idle_connections,
                        active_connections: pool_state.connections,
                        total_collections: 0,
                        total_records: 0,
                    }
                }
            }
        }
        Err(_) => {
            let pool_state = state.db_pool.state();
            DatabaseHealth {
                status: "connection_failed".to_string(),
                connection_pool_size: pool_state.connections + pool_state.idle_connections,
                active_connections: pool_state.connections,
                total_collections: 0,
                total_records: 0,
            }
        }
    }
}

fn get_memory_info() -> MemoryInfo {
    let mut sys = System::new_all();
    sys.refresh_memory();

    let total_mb = sys.total_memory() as f64 / (1024.0 * 1024.0);
    let used_mb = sys.used_memory() as f64 / (1024.0 * 1024.0);

    let usage_percentage = if total_mb > 0.0 {
        (used_mb / total_mb) * 100.0
    } else {
        0.0
    };

    MemoryInfo {
        used_mb,
        total_mb,
        usage_percentage,
    }
}

fn get_system_info() -> SystemInfo {
    let cpu_usage = get_cpu_usage();
    let load_average = get_load_average();
    let disk_usage_percentage = get_disk_usage();

    SystemInfo {
        cpu_usage,
        load_average,
        disk_usage_percentage,
    }
}

fn get_uptime_seconds() -> u64 {
    if let Some(start_time) = APP_START_TIME.get() {
        SystemTime::now()
            .duration_since(*start_time)
            .unwrap_or_default()
            .as_secs()
    } else {
        0
    }
}

fn estimate_total_records(conn: &mut diesel::SqliteConnection) -> i64 {
    // Get all collection names first
    let collections_query = "SELECT name FROM collections";
    match diesel::sql_query(collections_query).load::<CollectionName>(conn) {
        Ok(collections) => {
            let mut total_records = 0i64;

            // For each collection, count records in its data table
            for collection in collections {
                let table_name = format!("collection_{}_data", collection.name);
                let count_query = format!("SELECT COUNT(*) as count FROM {}", table_name);

                match diesel::sql_query(&count_query).load::<CountResult>(conn) {
                    Ok(results) => {
                        if let Some(result) = results.first() {
                            total_records += result.count;
                        }
                    }
                    Err(_) => {
                        // Table might not exist or be accessible, skip silently
                        continue;
                    }
                }
            }

            total_records
        }
        Err(_) => 0,
    }
}

fn get_cpu_usage() -> f64 {
    let mut sys = System::new_all();
    sys.refresh_cpu_all();

    // Wait a bit to get accurate CPU usage
    std::thread::sleep(std::time::Duration::from_millis(200));
    sys.refresh_cpu_all();

    // Calculate average CPU usage across all cores
    let cpus = sys.cpus();
    if cpus.is_empty() {
        return 0.0;
    }

    let total_usage: f32 = cpus.iter().map(|cpu| cpu.cpu_usage()).sum();
    (total_usage / cpus.len() as f32) as f64
}

fn get_load_average() -> f64 {
    if cfg!(target_os = "linux") || cfg!(target_os = "macos") {
        match std::fs::read_to_string("/proc/loadavg") {
            Ok(content) => content
                .split_whitespace()
                .next()
                .and_then(|s| s.parse::<f64>().ok())
                .unwrap_or(0.0),
            Err(_) => {
                // Fallback for macOS
                match std::process::Command::new("uptime").output() {
                    Ok(output) => {
                        let output_str = String::from_utf8_lossy(&output.stdout);
                        if let Some(load_part) = output_str.split("load averages:").nth(1) {
                            load_part
                                .split_whitespace()
                                .next()
                                .and_then(|s| s.parse::<f64>().ok())
                                .unwrap_or(0.0)
                        } else {
                            0.0
                        }
                    }
                    Err(_) => 0.0,
                }
            }
        }
    } else {
        0.0
    }
}

fn get_disk_usage() -> f64 {
    match std::process::Command::new("df").args(["-h", "."]).output() {
        Ok(output) => {
            let output_str = String::from_utf8_lossy(&output.stdout);
            for line in output_str.lines().skip(1) {
                // Skip header
                let parts: Vec<&str> = line.split_whitespace().collect();
                if parts.len() >= 5 {
                    if let Some(usage_str) = parts.get(4) {
                        return usage_str
                            .trim_end_matches('%')
                            .parse::<f64>()
                            .unwrap_or(0.0);
                    }
                }
            }
            0.0
        }
        Err(_) => 0.0,
    }
}

#[derive(QueryableByName)]
struct CountResult {
    #[diesel(sql_type = diesel::sql_types::BigInt)]
    count: i64,
}

#[derive(QueryableByName)]
struct CollectionName {
    #[diesel(sql_type = diesel::sql_types::Text)]
    name: String,
}
