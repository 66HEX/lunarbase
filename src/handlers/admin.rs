use axum::response::{Html, IntoResponse};
use tower_http::services::{ServeDir, ServeFile};

// Serve the main admin HTML page
pub async fn serve_admin_html() -> impl IntoResponse {
    let html = include_str!("../../admin-ui/dist/index.html");
    Html(html)
}

// Create service for serving static assets with SPA fallback
pub fn serve_admin_assets() -> ServeDir<ServeFile> {
    ServeDir::new("admin-ui/dist").fallback(ServeFile::new("admin-ui/dist/index.html"))
}

// Handle admin routes that should serve the SPA
pub async fn handle_admin_routes() -> impl IntoResponse {
    serve_admin_html().await
}
