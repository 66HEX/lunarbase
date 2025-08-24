use axum::{
    extract::Path,
    http::{StatusCode, header},
    response::{Html, IntoResponse, Response},
};
use std::borrow::Cow;
use tracing::debug;

use crate::embedded_assets::AdminAssets;

pub async fn serve_embedded_admin_html() -> impl IntoResponse {
    match AdminAssets::get_asset_with_mime("admin/index.html") {
        Some((content, mime_type)) => {
            let html = String::from_utf8_lossy(&content);
            ([(header::CONTENT_TYPE, mime_type)], Html(html.to_string())).into_response()
        }
        None => {
            tracing::warn!("Embedded admin assets not found, this might be a development build");
            (
                StatusCode::NOT_FOUND,
                "Admin interface not available. Build with --release or set LUNARBASE_BUILD_FRONTEND=1",
            )
                .into_response()
        }
    }
}

pub async fn serve_embedded_assets(Path(path): Path<String>) -> Response {
    debug!("serve_embedded_assets called with path: {}", path);
    let normalized_path = if path.starts_with("admin/") {
        path
    } else {
        format!("admin/{}", path)
    };
    debug!("normalized_path: {}", normalized_path);

    match AdminAssets::get_asset_with_mime(&normalized_path) {
        Some((content, mime_type)) => {
            debug!(
                "Found asset for path: {}, mime_type: {}",
                normalized_path, mime_type
            );
            create_asset_response(content, mime_type)
        }
        None => {
            debug!(
                "Asset not found for path: {}, checking SPA fallback conditions",
                normalized_path
            );
            if !normalized_path.contains('.') || normalized_path.ends_with('/') {
                debug!("SPA fallback for path: {}", normalized_path);
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
                        (StatusCode::NOT_FOUND, "Admin interface not available").into_response()
                    }
                }
            } else {
                (StatusCode::NOT_FOUND, "Asset not found").into_response()
            }
        }
    }
}

pub async fn serve_embedded_asset_by_path(Path(asset_path): Path<String>) -> impl IntoResponse {
    let normalized_path = if asset_path.starts_with("admin/") {
        asset_path
    } else {
        format!("admin/{}", asset_path)
    };

    match AdminAssets::get_asset_with_mime(&normalized_path) {
        Some((content, mime_type)) => create_asset_response(content, mime_type),
        None => (
            StatusCode::NOT_FOUND,
            format!("Asset not found: {}", normalized_path),
        )
            .into_response(),
    }
}

pub async fn handle_embedded_admin_routes() -> impl IntoResponse {
    serve_embedded_admin_html().await
}

fn create_asset_response(content: Cow<'static, [u8]>, mime_type: &'static str) -> Response {
    let mut response = Response::builder()
        .status(StatusCode::OK)
        .header(header::CONTENT_TYPE, mime_type)
        .header(header::CACHE_CONTROL, "public, max-age=31536000")
        .body(axum::body::Body::from(content.into_owned()))
        .unwrap();

    response
        .headers_mut()
        .insert(header::X_CONTENT_TYPE_OPTIONS, "nosniff".parse().unwrap());

    response
}

pub async fn embedded_assets_health() -> impl IntoResponse {
    if AdminAssets::is_available() {
        (StatusCode::OK, "Embedded admin assets are available")
    } else {
        (
            StatusCode::SERVICE_UNAVAILABLE,
            "Embedded admin assets are not available",
        )
    }
}

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
        assert!(
            response.status() == StatusCode::OK
                || response.status() == StatusCode::SERVICE_UNAVAILABLE
        );
    }
}
