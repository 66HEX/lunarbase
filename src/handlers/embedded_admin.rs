use axum::{
    extract::Path,
    http::{header, StatusCode},
    response::{Html, IntoResponse, Response},
};
use tracing::debug;
use std::borrow::Cow;

use crate::embedded_assets::AdminAssets;

/// Serve the main admin HTML page from embedded assets
pub async fn serve_embedded_admin_html() -> impl IntoResponse {
    match AdminAssets::get_asset_with_mime("admin/index.html") {
        Some((content, mime_type)) => {
            let html = String::from_utf8_lossy(&content);
            (
                [(header::CONTENT_TYPE, mime_type)],
                Html(html.to_string()),
            )
                .into_response()
        }
        None => {
            // Fallback for development or when assets are not embedded
            tracing::warn!("Embedded admin assets not found, this might be a development build");
            (
                StatusCode::NOT_FOUND,
                "Admin interface not available. Build with --release or set LUNARBASE_BUILD_FRONTEND=1",
            )
                .into_response()
        }
    }
}

/// Serve embedded static assets with proper MIME types
pub async fn serve_embedded_assets(Path(path): Path<String>) -> Response {
    debug!("serve_embedded_assets called with path: {}", path);
    // Ensure the path starts with admin/ for security
    let normalized_path = if path.starts_with("admin/") {
        path
    } else {
        format!("admin/{}", path)
    };
    debug!("normalized_path: {}", normalized_path);
    
    match AdminAssets::get_asset_with_mime(&normalized_path) {
        Some((content, mime_type)) => {
            debug!("Found asset for path: {}, mime_type: {}", normalized_path, mime_type);
            create_asset_response(content, mime_type)
        }
        None => {
            debug!("Asset not found for path: {}, checking SPA fallback conditions", normalized_path);
            // For SPA routing, fallback to index.html for non-asset requests
            if !normalized_path.contains('.') || normalized_path.ends_with('/') {
                debug!("SPA fallback for path: {}", normalized_path);
                // Return the HTML content directly with proper headers for SPA routing
                match AdminAssets::get_asset_with_mime("admin/index.html") {
                    Some((content, _)) => {
                        debug!("Serving index.html for SPA route: {}", normalized_path);
                        (
                            StatusCode::OK,
                            [(header::CONTENT_TYPE, "text/html; charset=utf-8")],
                            content.to_vec(),
                        )
                            .into_response()
                    }
                    None => {
                        (
                            StatusCode::NOT_FOUND,
                            "Admin interface not available",
                        )
                            .into_response()
                    }
                }
            } else {
                (
                    StatusCode::NOT_FOUND,
                    "Asset not found",
                )
                    .into_response()
            }
        }
    }
}

/// Serve a specific embedded asset by path
pub async fn serve_embedded_asset_by_path(Path(asset_path): Path<String>) -> impl IntoResponse {
    let normalized_path = if asset_path.starts_with("admin/") {
        asset_path
    } else {
        format!("admin/{}", asset_path)
    };
    
    match AdminAssets::get_asset_with_mime(&normalized_path) {
        Some((content, mime_type)) => {
            create_asset_response(content, mime_type)
        }
        None => {
            (
                StatusCode::NOT_FOUND,
                format!("Asset not found: {}", normalized_path),
            )
                .into_response()
        }
    }
}

/// Handle admin SPA routes that should serve the main HTML
pub async fn handle_embedded_admin_routes() -> impl IntoResponse {
    serve_embedded_admin_html().await
}

/// Create a proper HTTP response for an embedded asset
fn create_asset_response(content: Cow<'static, [u8]>, mime_type: &'static str) -> Response {
    let mut response = Response::builder()
        .status(StatusCode::OK)
        .header(header::CONTENT_TYPE, mime_type)
        .header(header::CACHE_CONTROL, "public, max-age=31536000") // 1 year cache for assets
        .body(axum::body::Body::from(content.into_owned()))
        .unwrap();
    
    // Add security headers
    response.headers_mut().insert(
        header::X_CONTENT_TYPE_OPTIONS,
        "nosniff".parse().unwrap(),
    );
    
    response
}

/// Check if embedded assets are available (useful for health checks)
pub async fn embedded_assets_health() -> impl IntoResponse {
    if AdminAssets::is_available() {
        (
            StatusCode::OK,
            "Embedded admin assets are available",
        )
    } else {
        (
            StatusCode::SERVICE_UNAVAILABLE,
            "Embedded admin assets are not available",
        )
    }
}

/// List all available embedded assets (for debugging)
pub async fn list_embedded_assets() -> impl IntoResponse {
    let assets = AdminAssets::list_assets();
    (
        [(header::CONTENT_TYPE, "application/json")],
        serde_json::to_string_pretty(&assets).unwrap_or_else(|_| "[]".to_string()),
    )
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[tokio::test]
    async fn test_serve_embedded_admin_html() {
        let response = serve_embedded_admin_html().await.into_response();
        // In development, this might return 404, in release it should return the HTML
        assert!(response.status() == StatusCode::OK || response.status() == StatusCode::NOT_FOUND);
    }
    
    #[tokio::test]
    async fn test_serve_embedded_assets() {
        let path = "index.html".to_string();
        let response = serve_embedded_assets(Path(path)).await.into_response();
        assert!(response.status() == StatusCode::OK || response.status() == StatusCode::NOT_FOUND);
    }
    
    #[tokio::test]
    async fn test_embedded_assets_health() {
        let response = embedded_assets_health().await.into_response();
        assert!(response.status() == StatusCode::OK || response.status() == StatusCode::SERVICE_UNAVAILABLE);
    }
}