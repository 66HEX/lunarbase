use axum::{
    extract::{Request, State},
    http::header::AUTHORIZATION,
    middleware::Next,
    response::Response,
};
use std::sync::Arc;

use crate::services::{ConfigurationAccess, ConfigurationManager};
use crate::utils::{Claims, CookieService, JwtService, LunarbaseError};
use diesel::SqliteConnection;
use diesel::r2d2::{ConnectionManager, Pool};

#[derive(Clone)]
pub struct AuthState {
    pub jwt_service: Arc<JwtService>,
    pub config_manager: ConfigurationManager,
}

impl AuthState {
    pub async fn new(
        jwt_secret: &str,
        pool: Pool<ConnectionManager<SqliteConnection>>,
        config_manager: ConfigurationManager,
    ) -> Self {
        Self {
            jwt_service: Arc::new(JwtService::new(
                jwt_secret,
                pool.clone(),
                config_manager.clone(),
            )),
            config_manager,
        }
    }
}

impl ConfigurationAccess for AuthState {
    fn config_manager(&self) -> &ConfigurationManager {
        &self.config_manager
    }
}

pub fn extract_user_claims(request: &Request) -> Result<Claims, LunarbaseError> {
    request
        .extensions()
        .get::<Claims>()
        .ok_or(LunarbaseError::TokenInvalid)
        .map(|claims| claims.clone())
}

pub async fn auth_middleware(
    State(auth_state): State<AuthState>,
    mut request: Request,
    next: Next,
) -> Result<Response, LunarbaseError> {
    tracing::debug!("Request headers: {:?}", request.headers());

    let token = if let Some(cookie_token) = CookieService::extract_access_token(request.headers()) {
        tracing::debug!(
            "Found token in cookie: {}",
            &cookie_token[..std::cmp::min(10, cookie_token.len())]
        );
        cookie_token
    } else if let Some(auth_header) = request
        .headers()
        .get(AUTHORIZATION)
        .and_then(|header| header.to_str().ok())
    {
        tracing::debug!("Found token in Authorization header");
        JwtService::extract_token_from_header(auth_header)?.to_string()
    } else {
        tracing::debug!("No token found in cookies or Authorization header");
        return Err(LunarbaseError::TokenInvalid);
    };

    let claims = auth_state
        .jwt_service
        .validate_access_token_with_verification(&token)?;

    request.extensions_mut().insert(claims);

    Ok(next.run(request).await)
}

pub async fn optional_auth_middleware(
    State(auth_state): State<AuthState>,
    mut request: Request,
    next: Next,
) -> Response {
    let token = if let Some(cookie_token) = CookieService::extract_access_token(request.headers()) {
        Some(cookie_token)
    } else if let Some(auth_header) = request
        .headers()
        .get(AUTHORIZATION)
        .and_then(|header| header.to_str().ok())
    {
        JwtService::extract_token_from_header(auth_header)
            .ok()
            .map(|s| s.to_string())
    } else {
        None
    };

    if let Some(token) = token {
        if let Ok(claims) = auth_state
            .jwt_service
            .validate_access_token_with_blacklist(&token)
        {
            request.extensions_mut().insert(claims);
        }
    }

    next.run(request).await
}

pub fn check_user_role(claims: &Claims, required_role: &str) -> bool {
    claims.role == required_role || claims.role == "admin"
}
