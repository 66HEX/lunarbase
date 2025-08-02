use axum::http::{HeaderMap, HeaderValue, header::SET_COOKIE};
use chrono::{Duration, Utc};
use std::env;

/// Konfiguracja ciasteczek dla różnych środowisk
#[derive(Debug, Clone)]
pub struct CookieConfig {
    pub secure: bool,
    pub same_site: String,
    pub domain: Option<String>,
    pub http_only: bool,
}

impl Default for CookieConfig {
    fn default() -> Self {
        let is_production = env::var("ENVIRONMENT")
            .unwrap_or_else(|_| "development".to_string())
            .to_lowercase()
            == "production";

        Self {
            secure: is_production,
            same_site: "Lax".to_string(),
            domain: None,
            http_only: true,
        }
    }
}

/// Serwis do zarządzania ciasteczkami JWT
pub struct CookieService {
    config: CookieConfig,
}

impl CookieService {
    pub fn new() -> Self {
        Self {
            config: CookieConfig::default(),
        }
    }

    pub fn with_config(config: CookieConfig) -> Self {
        Self { config }
    }

    /// Ustawia access token jako ciasteczko httpOnly
    pub fn set_access_token_cookie(&self, headers: &mut HeaderMap, token: &str) {
        let cookie_value = self.build_cookie(
            "access_token",
            token,
            Duration::minutes(15), // 15 minut
            "/",
        );

        if let Ok(header_value) = HeaderValue::from_str(&cookie_value) {
            headers.append(SET_COOKIE, header_value);
        }
    }

    /// Ustawia refresh token jako ciasteczko httpOnly
    pub fn set_refresh_token_cookie(&self, headers: &mut HeaderMap, token: &str) {
        let cookie_value = self.build_cookie("refresh_token", token, Duration::days(7), "/");

        if let Ok(header_value) = HeaderValue::from_str(&cookie_value) {
            headers.append(SET_COOKIE, header_value);
        }
    }

    /// Usuwa access token (ustawia puste ciasteczko z przeszłą datą)
    pub fn clear_access_token_cookie(&self, headers: &mut HeaderMap) {
        let cookie_value = self.build_clear_cookie("access_token", "/");

        if let Ok(header_value) = HeaderValue::from_str(&cookie_value) {
            headers.append(SET_COOKIE, header_value);
        }
    }

    /// Usuwa refresh token (ustawia puste ciasteczko z przeszłą datą)
    pub fn clear_refresh_token_cookie(&self, headers: &mut HeaderMap) {
        let cookie_value = self.build_clear_cookie("refresh_token", "/");

        if let Ok(header_value) = HeaderValue::from_str(&cookie_value) {
            headers.append(SET_COOKIE, header_value);
        }
    }

    /// Usuwa oba tokeny
    pub fn clear_all_tokens(&self, headers: &mut HeaderMap) {
        self.clear_access_token_cookie(headers);
        self.clear_refresh_token_cookie(headers);
    }

    /// Buduje string ciasteczka z odpowiednimi flagami bezpieczeństwa
    fn build_cookie(&self, name: &str, value: &str, max_age: Duration, path: &str) -> String {
        let expires = Utc::now() + max_age;
        let expires_str = expires.format("%a, %d %b %Y %H:%M:%S GMT").to_string();

        let mut cookie = format!(
            "{}={}; Path={}; Expires={}; Max-Age={}",
            name,
            value,
            path,
            expires_str,
            max_age.num_seconds()
        );

        if self.config.http_only {
            cookie.push_str("; HttpOnly");
        }

        if self.config.secure {
            cookie.push_str("; Secure");
        }

        cookie.push_str(&format!("; SameSite={}", self.config.same_site));

        if let Some(ref domain) = self.config.domain {
            cookie.push_str(&format!("; Domain={}", domain));
        }

        cookie
    }

    /// Buduje string ciasteczka do usunięcia (z przeszłą datą)
    fn build_clear_cookie(&self, name: &str, path: &str) -> String {
        let mut cookie = format!(
            "{}=; Path={}; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Max-Age=0",
            name, path
        );

        if self.config.http_only {
            cookie.push_str("; HttpOnly");
        }

        if self.config.secure {
            cookie.push_str("; Secure");
        }

        cookie.push_str(&format!("; SameSite={}", self.config.same_site));

        if let Some(ref domain) = self.config.domain {
            cookie.push_str(&format!("; Domain={}", domain));
        }

        cookie
    }

    /// Ekstraktuje token z ciasteczka
    pub fn extract_token_from_cookies(headers: &HeaderMap, token_name: &str) -> Option<String> {
        // Try different possible cookie header names
        let cookie_headers = ["cookie", "Cookie", "COOKIE"];

        for header_name in &cookie_headers {
            if let Some(result) = headers
                .get(*header_name)
                .and_then(|cookie_header| cookie_header.to_str().ok())
                .and_then(|cookie_str| {
                    cookie_str.split(';').find_map(|cookie| {
                        let cookie = cookie.trim();
                        if cookie.starts_with(&format!("{}=", token_name)) {
                            Some(cookie[token_name.len() + 1..].to_string())
                        } else {
                            None
                        }
                    })
                })
            {
                return Some(result);
            }
        }

        None
    }

    /// Ekstraktuje access token z ciasteczka
    pub fn extract_access_token(headers: &HeaderMap) -> Option<String> {
        Self::extract_token_from_cookies(headers, "access_token")
    }

    /// Ekstraktuje refresh token z ciasteczka
    pub fn extract_refresh_token(headers: &HeaderMap) -> Option<String> {
        Self::extract_token_from_cookies(headers, "refresh_token")
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::http::HeaderMap;

    #[test]
    fn test_cookie_creation() {
        let service = CookieService::new();
        let mut headers = HeaderMap::new();

        service.set_access_token_cookie(&mut headers, "test_token");

        let cookie_header = headers.get(SET_COOKIE).unwrap();
        let cookie_str = cookie_header.to_str().unwrap();

        assert!(cookie_str.contains("access_token=test_token"));
        assert!(cookie_str.contains("HttpOnly"));
        assert!(cookie_str.contains("SameSite=Lax"));
        assert!(cookie_str.contains("Path=/"));
    }

    #[test]
    fn test_token_extraction() {
        let mut headers = HeaderMap::new();
        headers.insert(
            "cookie",
            "access_token=test123; other_cookie=value".parse().unwrap(),
        );

        let token = CookieService::extract_access_token(&headers);
        assert_eq!(token, Some("test123".to_string()));
    }

    #[test]
    fn test_clear_cookies() {
        let service = CookieService::new();
        let mut headers = HeaderMap::new();

        service.clear_access_token_cookie(&mut headers);

        let cookie_header = headers.get(SET_COOKIE).unwrap();
        let cookie_str = cookie_header.to_str().unwrap();

        assert!(cookie_str.contains("access_token="));
        assert!(cookie_str.contains("Max-Age=0"));
        assert!(cookie_str.contains("Expires=Thu, 01 Jan 1970"));
    }
}
