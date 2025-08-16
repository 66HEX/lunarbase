use oauth2::{
    AuthUrl, AuthorizationCode, ClientId, ClientSecret, CsrfToken, PkceCodeChallenge,
    PkceCodeVerifier, RedirectUrl, Scope, TokenResponse, TokenUrl, basic::BasicClient,
};
use reqwest::Client as HttpClient;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::{Arc, Mutex};

#[derive(Debug, Clone)]
pub struct OAuthConfig {
    pub google: Option<OAuthProviderConfig>,
    pub github: Option<OAuthProviderConfig>,
    pub redirect_base_url: String,
}

#[derive(Debug, Clone)]
pub struct OAuthProviderConfig {
    pub client_id: String,
    pub client_secret: String,
    pub auth_url: String,
    pub token_url: String,
    pub scopes: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct OAuthUserInfo {
    pub id: String,
    pub email: String,
    pub name: Option<String>,
    pub avatar_url: Option<String>,
    pub provider: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GoogleUserInfo {
    pub id: String,
    pub email: String,
    pub name: Option<String>,
    pub picture: Option<String>,
    pub verified_email: Option<bool>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GitHubUserInfo {
    pub id: u64,
    pub login: String,
    pub email: Option<String>,
    pub name: Option<String>,
    pub avatar_url: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GitHubEmail {
    pub email: String,
    pub primary: bool,
    pub verified: bool,
    pub visibility: Option<String>,
}

#[derive(Clone)]
pub struct OAuthService {
    config: OAuthConfig,
    http_client: HttpClient,
    pkce_verifiers: Arc<Mutex<HashMap<String, PkceCodeVerifier>>>,
}

impl OAuthService {
    pub fn new(config: OAuthConfig) -> Self {
        let http_client = HttpClient::builder()
            .redirect(reqwest::redirect::Policy::none())
            .build()
            .expect("Failed to create HTTP client");

        Self {
            config,
            http_client,
            pkce_verifiers: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    pub fn get_authorization_url(
        &self,
        provider: &str,
    ) -> Result<(String, String), Box<dyn std::error::Error>> {
        let provider_config = match provider {
            "google" => self.config.google.as_ref(),
            "github" => self.config.github.as_ref(),
            _ => return Err("Unsupported OAuth provider".into()),
        }
        .ok_or("OAuth provider not configured")?;

        let redirect_url = format!(
            "{}/api/auth/oauth/{}/callback",
            self.config.redirect_base_url, provider
        );

        let client = BasicClient::new(ClientId::new(provider_config.client_id.clone()))
            .set_client_secret(ClientSecret::new(provider_config.client_secret.clone()))
            .set_auth_uri(AuthUrl::new(provider_config.auth_url.clone())?)
            .set_token_uri(TokenUrl::new(provider_config.token_url.clone())?)
            .set_redirect_uri(RedirectUrl::new(redirect_url)?);

        let (pkce_challenge, pkce_verifier) = PkceCodeChallenge::new_random_sha256();

        let mut auth_request = client.authorize_url(CsrfToken::new_random);

        // Add scopes
        for scope in &provider_config.scopes {
            auth_request = auth_request.add_scope(Scope::new(scope.clone()));
        }

        // Use PKCE for Google (recommended)
        if provider == "google" {
            auth_request = auth_request.set_pkce_challenge(pkce_challenge);
        }

        let (auth_url, csrf_token) = auth_request.url();

        // Store PKCE verifier for Google OAuth
        if provider == "google" {
            if let Ok(mut verifiers) = self.pkce_verifiers.lock() {
                verifiers.insert(csrf_token.secret().clone(), pkce_verifier);
            }
        }

        Ok((auth_url.to_string(), csrf_token.secret().clone()))
    }

    pub async fn exchange_code_for_token(
        &self,
        provider: &str,
        code: &str,
        state: &str,
    ) -> Result<String, Box<dyn std::error::Error>> {
        let provider_config = match provider {
            "google" => self.config.google.as_ref(),
            "github" => self.config.github.as_ref(),
            _ => return Err("Unsupported OAuth provider".into()),
        }
        .ok_or("OAuth provider not configured")?;

        let redirect_url = format!(
            "{}/api/auth/oauth/{}/callback",
            self.config.redirect_base_url, provider
        );

        let client = BasicClient::new(ClientId::new(provider_config.client_id.clone()))
            .set_client_secret(ClientSecret::new(provider_config.client_secret.clone()))
            .set_auth_uri(AuthUrl::new(provider_config.auth_url.clone())?)
            .set_token_uri(TokenUrl::new(provider_config.token_url.clone())?)
            .set_redirect_uri(RedirectUrl::new(redirect_url)?);

        let mut token_request = client.exchange_code(AuthorizationCode::new(code.to_string()));

        // Use PKCE verifier for Google OAuth
        if provider == "google" {
            if let Ok(mut verifiers) = self.pkce_verifiers.lock() {
                if let Some(pkce_verifier) = verifiers.remove(state) {
                    token_request = token_request.set_pkce_verifier(pkce_verifier);
                } else {
                    return Err("PKCE verifier not found for state".into());
                }
            } else {
                return Err("Failed to access PKCE verifiers".into());
            }
        }

        let token_result = token_request.request_async(&self.http_client).await?;

        Ok(token_result.access_token().secret().clone())
    }

    pub async fn get_user_info(
        &self,
        provider: &str,
        access_token: &str,
    ) -> Result<OAuthUserInfo, Box<dyn std::error::Error>> {
        match provider {
            "google" => self.get_google_user_info(access_token).await,
            "github" => self.get_github_user_info(access_token).await,
            _ => Err("Unsupported OAuth provider".into()),
        }
    }

    async fn get_google_user_info(
        &self,
        access_token: &str,
    ) -> Result<OAuthUserInfo, Box<dyn std::error::Error>> {
        let response = self
            .http_client
            .get("https://www.googleapis.com/oauth2/v2/userinfo")
            .bearer_auth(access_token)
            .send()
            .await?;

        let google_user: GoogleUserInfo = response.json().await?;

        Ok(OAuthUserInfo {
            id: google_user.id,
            email: google_user.email,
            name: google_user.name,
            avatar_url: google_user.picture,
            provider: "google".to_string(),
        })
    }

    async fn get_github_user_info(
        &self,
        access_token: &str,
    ) -> Result<OAuthUserInfo, Box<dyn std::error::Error>> {
        // Get user info
        let user_response = self
            .http_client
            .get("https://api.github.com/user")
            .bearer_auth(access_token)
            .header("User-Agent", "lunarbase-oauth")
            .send()
            .await?;

        let github_user: GitHubUserInfo = user_response.json().await?;

        // Get primary email if not public
        let email = if github_user.email.is_some() {
            github_user.email.unwrap()
        } else {
            let emails_response = self
                .http_client
                .get("https://api.github.com/user/emails")
                .bearer_auth(access_token)
                .header("User-Agent", "lunarbase-oauth")
                .send()
                .await?;

            let emails: Vec<GitHubEmail> = emails_response.json().await?;
            emails
                .into_iter()
                .find(|e| e.primary && e.verified)
                .map(|e| e.email)
                .ok_or("No verified primary email found")?
        };

        Ok(OAuthUserInfo {
            id: github_user.id.to_string(),
            email,
            name: github_user.name,
            avatar_url: github_user.avatar_url,
            provider: "github".to_string(),
        })
    }
}

impl OAuthConfig {
    pub fn from_env() -> Self {
        let google = if let (Ok(client_id), Ok(client_secret)) = (
            std::env::var("GOOGLE_CLIENT_ID"),
            std::env::var("GOOGLE_CLIENT_SECRET"),
        ) {
            Some(OAuthProviderConfig {
                client_id,
                client_secret,
                auth_url: "https://accounts.google.com/o/oauth2/v2/auth".to_string(),
                token_url: "https://www.googleapis.com/oauth2/v3/token".to_string(),
                scopes: vec![
                    "https://www.googleapis.com/auth/userinfo.email".to_string(),
                    "https://www.googleapis.com/auth/userinfo.profile".to_string(),
                ],
            })
        } else {
            None
        };

        let github = if let (Ok(client_id), Ok(client_secret)) = (
            std::env::var("GITHUB_CLIENT_ID"),
            std::env::var("GITHUB_CLIENT_SECRET"),
        ) {
            Some(OAuthProviderConfig {
                client_id,
                client_secret,
                auth_url: "https://github.com/login/oauth/authorize".to_string(),
                token_url: "https://github.com/login/oauth/access_token".to_string(),
                scopes: vec!["user:email".to_string()],
            })
        } else {
            None
        };

        let redirect_base_url = std::env::var("FRONTEND_URL")
            .unwrap_or_else(|_| "https://localhost:3000".to_string());

        Self {
            google,
            github,
            redirect_base_url,
        }
    }
}
