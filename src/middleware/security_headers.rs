use serde::{Deserialize, Serialize};
use axum::{
    http::{Request, Response, HeaderMap, HeaderName, HeaderValue},
    middleware::Next,
    body::Body,
};
use tracing::{debug, warn};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SecurityHeadersConfig {
    pub enabled: bool,
    pub hsts: HstsConfig,
    pub content_type_options: bool,
    pub frame_options: FrameOptionsConfig,
    pub xss_protection: bool,
    pub csp: CspConfig,
    pub referrer_policy: ReferrerPolicyConfig,
    pub permissions_policy: PermissionsPolicyConfig,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HstsConfig {
    pub enabled: bool,
    pub max_age: u32,
    pub include_subdomains: bool,
    pub preload: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FrameOptionsConfig {
    pub enabled: bool,
    pub policy: FrameOptionsPolicy,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum FrameOptionsPolicy {
    Deny,
    SameOrigin,
    AllowFrom(String),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CspConfig {
    pub enabled: bool,
    pub policy: String,
    pub report_only: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReferrerPolicyConfig {
    pub enabled: bool,
    pub policy: ReferrerPolicy,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ReferrerPolicy {
    NoReferrer,
    NoReferrerWhenDowngrade,
    Origin,
    OriginWhenCrossOrigin,
    SameOrigin,
    StrictOrigin,
    StrictOriginWhenCrossOrigin,
    UnsafeUrl,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PermissionsPolicyConfig {
    pub enabled: bool,
    pub policy: String,
}

impl Default for SecurityHeadersConfig {
    fn default() -> Self {
        Self {
            enabled: true,
            hsts: HstsConfig::default(),
            content_type_options: true,
            frame_options: FrameOptionsConfig::default(),
            xss_protection: true,
            csp: CspConfig::default(),
            referrer_policy: ReferrerPolicyConfig::default(),
            permissions_policy: PermissionsPolicyConfig::default(),
        }
    }
}

impl Default for HstsConfig {
    fn default() -> Self {
        Self {
            enabled: true,
            max_age: 31536000, // 1 year
            include_subdomains: true,
            preload: false,
        }
    }
}

impl Default for FrameOptionsConfig {
    fn default() -> Self {
        Self {
            enabled: true,
            policy: FrameOptionsPolicy::Deny,
        }
    }
}

impl Default for CspConfig {
    fn default() -> Self {
        Self {
            enabled: true,
            policy: "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'".to_string(),
            report_only: false,
        }
    }
}

impl Default for ReferrerPolicyConfig {
    fn default() -> Self {
        Self {
            enabled: true,
            policy: ReferrerPolicy::StrictOriginWhenCrossOrigin,
        }
    }
}

impl Default for PermissionsPolicyConfig {
    fn default() -> Self {
        Self {
            enabled: true,
            policy: "camera=(), microphone=(), geolocation=(), payment=()".to_string(),
        }
    }
}

impl SecurityHeadersConfig {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn production() -> Self {
        Self {
            enabled: true,
            hsts: HstsConfig {
                enabled: true,
                max_age: 63072000, // 2 years
                include_subdomains: true,
                preload: true,
            },
            content_type_options: true,
            frame_options: FrameOptionsConfig {
                enabled: true,
                policy: FrameOptionsPolicy::Deny,
            },
            xss_protection: true,
            csp: CspConfig {
                enabled: true,
                policy: "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'".to_string(),
                report_only: false,
            },
            referrer_policy: ReferrerPolicyConfig {
                enabled: true,
                policy: ReferrerPolicy::StrictOriginWhenCrossOrigin,
            },
            permissions_policy: PermissionsPolicyConfig {
                enabled: true,
                policy: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), bluetooth=()".to_string(),
            },
        }
    }

    pub fn development() -> Self {
        Self {
            enabled: true,
            hsts: HstsConfig {
                enabled: false, // Disable HSTS in development
                max_age: 0,
                include_subdomains: false,
                preload: false,
            },
            content_type_options: true,
            frame_options: FrameOptionsConfig {
                enabled: true,
                policy: FrameOptionsPolicy::SameOrigin,
            },
            xss_protection: true,
            csp: CspConfig {
                enabled: true,
                policy: "default-src 'self' 'unsafe-eval' 'unsafe-inline'; script-src 'self' 'unsafe-eval' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' ws: wss:".to_string(),
                report_only: true,
            },
            referrer_policy: ReferrerPolicyConfig {
                enabled: true,
                policy: ReferrerPolicy::NoReferrerWhenDowngrade,
            },
            permissions_policy: PermissionsPolicyConfig {
                enabled: false, // More permissive in development
                policy: String::new(),
            },
        }
    }

    pub fn validate(&self) -> Result<(), String> {
        if self.hsts.enabled && self.hsts.max_age == 0 {
            return Err("HSTS max_age must be greater than 0 when enabled".to_string());
        }

        if self.csp.enabled && self.csp.policy.is_empty() {
            return Err("CSP policy cannot be empty when CSP is enabled".to_string());
        }

        if self.permissions_policy.enabled && self.permissions_policy.policy.is_empty() {
            return Err("Permissions policy cannot be empty when enabled".to_string());
        }

        Ok(())
    }
}

impl FrameOptionsPolicy {
    fn to_header_value(&self) -> String {
        match self {
            FrameOptionsPolicy::Deny => "DENY".to_string(),
            FrameOptionsPolicy::SameOrigin => "SAMEORIGIN".to_string(),
            FrameOptionsPolicy::AllowFrom(uri) => format!("ALLOW-FROM {}", uri),
        }
    }
}

impl ReferrerPolicy {
    fn to_header_value(&self) -> &'static str {
        match self {
            ReferrerPolicy::NoReferrer => "no-referrer",
            ReferrerPolicy::NoReferrerWhenDowngrade => "no-referrer-when-downgrade",
            ReferrerPolicy::Origin => "origin",
            ReferrerPolicy::OriginWhenCrossOrigin => "origin-when-cross-origin",
            ReferrerPolicy::SameOrigin => "same-origin",
            ReferrerPolicy::StrictOrigin => "strict-origin",
            ReferrerPolicy::StrictOriginWhenCrossOrigin => "strict-origin-when-cross-origin",
            ReferrerPolicy::UnsafeUrl => "unsafe-url",
        }
    }
}

pub async fn security_headers_middleware(
    config: SecurityHeadersConfig,
    request: Request<Body>,
    next: Next,
) -> Response<Body> {
    if !config.enabled {
        return next.run(request).await;
    }

    let mut response = next.run(request).await;
    let headers = response.headers_mut();

    add_security_headers(headers, &config);
    
    response
}

fn add_security_headers(headers: &mut HeaderMap, config: &SecurityHeadersConfig) {
    if config.hsts.enabled {
        let mut hsts_value = format!("max-age={}", config.hsts.max_age);
        if config.hsts.include_subdomains {
            hsts_value.push_str("; includeSubDomains");
        }
        if config.hsts.preload {
            hsts_value.push_str("; preload");
        }
        
        if let Ok(value) = HeaderValue::from_str(&hsts_value) {
            headers.insert("strict-transport-security", value);
            debug!("Added HSTS header: {}", hsts_value);
        } else {
            warn!("Failed to create HSTS header value: {}", hsts_value);
        }
    }

    if config.content_type_options {
        let value = HeaderValue::from_static("nosniff");
        headers.insert("x-content-type-options", value);
        debug!("Added X-Content-Type-Options: nosniff");
    }

    if config.frame_options.enabled {
        let frame_options_value = config.frame_options.policy.to_header_value();
        if let Ok(value) = HeaderValue::from_str(&frame_options_value) {
            headers.insert("x-frame-options", value);
            debug!("Added X-Frame-Options: {}", frame_options_value);
        } else {
            warn!("Failed to create X-Frame-Options header value: {}", frame_options_value);
        }
    }

    if config.xss_protection {
        let value = HeaderValue::from_static("1; mode=block");
        headers.insert("x-xss-protection", value);
        debug!("Added X-XSS-Protection: 1; mode=block");
    }

    if config.csp.enabled && !config.csp.policy.is_empty() {
        let header_name = if config.csp.report_only {
            "content-security-policy-report-only"
        } else {
            "content-security-policy"
        };
        
        if let Ok(value) = HeaderValue::from_str(&config.csp.policy) {
            let name = HeaderName::from_static(header_name);
            headers.insert(name, value);
            debug!("Added {}: {}", header_name, config.csp.policy);
        } else {
            warn!("Failed to create CSP header value: {}", config.csp.policy);
        }
    }

    if config.referrer_policy.enabled {
        let referrer_value = config.referrer_policy.policy.to_header_value();
        let value = HeaderValue::from_static(referrer_value);
        headers.insert("referrer-policy", value);
        debug!("Added Referrer-Policy: {}", referrer_value);
    }

    if config.permissions_policy.enabled && !config.permissions_policy.policy.is_empty() {
        if let Ok(value) = HeaderValue::from_str(&config.permissions_policy.policy) {
            headers.insert("permissions-policy", value);
            debug!("Added Permissions-Policy: {}", config.permissions_policy.policy);
        } else {
            warn!("Failed to create Permissions-Policy header value: {}", config.permissions_policy.policy);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_security_headers_config_validation() {
        let mut config = SecurityHeadersConfig::default();
        assert!(config.validate().is_ok());

        config.hsts.enabled = true;
        config.hsts.max_age = 0;
        assert!(config.validate().is_err());

        config.hsts.max_age = 3600;
        config.csp.enabled = true;
        config.csp.policy = String::new();
        assert!(config.validate().is_err());
    }

    #[test]
    fn test_frame_options_policy() {
        assert_eq!(FrameOptionsPolicy::Deny.to_header_value(), "DENY");
        assert_eq!(FrameOptionsPolicy::SameOrigin.to_header_value(), "SAMEORIGIN");
        assert_eq!(
            FrameOptionsPolicy::AllowFrom("https://example.com".to_string()).to_header_value(),
            "ALLOW-FROM https://example.com"
        );
    }

    #[test]
    fn test_referrer_policy_values() {
        assert_eq!(ReferrerPolicy::NoReferrer.to_header_value(), "no-referrer");
        assert_eq!(ReferrerPolicy::StrictOriginWhenCrossOrigin.to_header_value(), "strict-origin-when-cross-origin");
    }

    #[test]
    fn test_production_config() {
        let config = SecurityHeadersConfig::production();
        assert!(config.enabled);
        assert!(config.hsts.enabled);
        assert!(config.hsts.preload);
        assert_eq!(config.hsts.max_age, 63072000);
        assert!(config.validate().is_ok());
    }

    #[test]
    fn test_development_config() {
        let config = SecurityHeadersConfig::development();
        assert!(config.enabled);
        assert!(!config.hsts.enabled);
        assert!(config.csp.report_only);
        assert!(!config.permissions_policy.enabled);
        assert!(config.validate().is_ok());
    }
}