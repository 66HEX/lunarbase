use axum::{extract::Query, http::StatusCode, response::Response};
use reqwest;
use serde::Deserialize;
use utoipa::{IntoParams, ToSchema};

#[derive(Deserialize, IntoParams, ToSchema)]
pub struct AvatarQuery {
    /// External avatar URL to proxy (must be from allowed domains)
    url: String,
}

/// Proxy external avatar images
#[utoipa::path(
    get,
    path = "/avatar-proxy",
    tag = "Avatar",
    params(
        AvatarQuery
    ),
    responses(
        (status = 200, description = "Avatar image proxied successfully", content_type = "image/*"),
        (status = 400, description = "Bad request - Invalid URL"),
        (status = 403, description = "Forbidden - Domain not allowed"),
        (status = 404, description = "Not found - Avatar image not found"),
        (status = 502, description = "Bad gateway - Failed to fetch external image")
    )
)]
pub async fn proxy_avatar(Query(params): Query<AvatarQuery>) -> Result<Response, StatusCode> {
    let url = &params.url;
    
    // Validate that the URL is from allowed domains
    if !is_allowed_avatar_domain(url) {
        return Err(StatusCode::FORBIDDEN);
    }
    
    // Fetch the image from the external URL
    let client = reqwest::Client::new();
    let response = client
        .get(url)
        .header("User-Agent", "LunarBase/1.0")
        .send()
        .await
        .map_err(|_| StatusCode::BAD_GATEWAY)?;
    
    if !response.status().is_success() {
        return Err(StatusCode::NOT_FOUND);
    }
    
    let content_type = response
        .headers()
        .get("content-type")
        .and_then(|ct| ct.to_str().ok())
        .unwrap_or("image/jpeg")
        .to_string();
    
    let bytes = response
        .bytes()
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    
    let response_builder = Response::builder()
        .status(StatusCode::OK)
        .header("Content-Type", content_type)
        .header("Cache-Control", "public, max-age=3600") // Cache for 1 hour
        .header("Access-Control-Allow-Origin", "*");
    
    response_builder
        .body(bytes.into())
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)
}

fn is_allowed_avatar_domain(url: &str) -> bool {
    let allowed_domains = [
        "lh3.googleusercontent.com",
        "avatars.githubusercontent.com",
        "graph.facebook.com",
        "pbs.twimg.com", // Twitter avatars
    ];
    
    allowed_domains.iter().any(|domain| url.contains(domain))
}