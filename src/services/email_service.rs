use resend_rs::{Resend, types::CreateEmailBaseOptions};
use uuid::Uuid;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use chrono::{DateTime, Utc, Duration};
use tracing::{info, warn, error};

use crate::utils::AuthError;
use crate::Config;

#[derive(Debug, Clone)]
pub struct VerificationToken {
    pub user_id: i32,
    pub email: String,
    pub expires_at: DateTime<Utc>,
}

#[derive(Clone)]
pub struct EmailService {
    resend_client: Option<Resend>,
    from_email: String,
    frontend_url: String,
    // In-memory storage for verification tokens (in production, use Redis or database)
    verification_tokens: Arc<RwLock<HashMap<String, VerificationToken>>>,
}

impl EmailService {
    pub fn new(config: &Config) -> Self {
        let resend_client = if let Some(api_key) = &config.resend_api_key {
            info!("EmailService: Initializing with Resend API key: {}...", &api_key[..10]);
            Some(Resend::new(api_key))
        } else {
            warn!("EmailService: No RESEND_API_KEY found in configuration");
            None
        };
        
        let from_email = config.email_from.clone().unwrap_or_default();
        info!("EmailService: Configured with from_email: {}, frontend_url: {}", from_email, config.frontend_url);
        
        Self {
            resend_client,
            from_email,
            frontend_url: config.frontend_url.clone(),
            verification_tokens: Arc::new(RwLock::new(HashMap::new())),
        }
    }



    /// Generate a verification token for a user
    pub async fn generate_verification_token(&self, user_id: i32, email: String) -> String {
        let token = Uuid::new_v4().to_string();
        let expires_at = Utc::now() + Duration::hours(24); // Token expires in 24 hours

        let verification_token = VerificationToken {
            user_id,
            email,
            expires_at,
        };

        let mut tokens = self.verification_tokens.write().await;
        tokens.insert(token.clone(), verification_token);

        // Clean up expired tokens
        let now = Utc::now();
        tokens.retain(|_, v| v.expires_at > now);

        token
    }

    /// Verify a token and return the user_id if valid
    pub async fn verify_token(&self, token: &str) -> Result<i32, AuthError> {
        let mut tokens = self.verification_tokens.write().await;
        
        if let Some(verification_token) = tokens.get(token) {
            if verification_token.expires_at > Utc::now() {
                let user_id = verification_token.user_id;
                // Remove the token after successful verification
                tokens.remove(token);
                return Ok(user_id);
            } else {
                // Remove expired token
                tokens.remove(token);
                return Err(AuthError::ValidationError(vec!["Verification token has expired".to_string()]));
            }
        }

        Err(AuthError::ValidationError(vec!["Invalid verification token".to_string()]))
    }

    /// Send verification email to user
    pub async fn send_verification_email(&self, user_id: i32, email: &str, username: &str) -> Result<(), AuthError> {
        info!("EmailService: Attempting to send verification email to {} for user_id: {}", email, user_id);
        
        let Some(ref resend_client) = self.resend_client else {
            warn!("Resend client not configured, skipping email verification");
            return Ok(());
        };

        // Generate verification token
        let token = self.generate_verification_token(user_id, email.to_string()).await;
        
        // Create verification URL
        let verification_url = format!("{}/api/verify-email?token={}", self.frontend_url, token);

        // Create email content
        let subject = "Verify your email address";
        let html_content = self.create_verification_email_html(username, &verification_url);
        let text_content = self.create_verification_email_text(username, &verification_url);

        // Send email
        let email_request = CreateEmailBaseOptions::new(&self.from_email, [email], subject)
            .with_html(&html_content)
            .with_text(&text_content);

        match resend_client.emails.send(email_request).await {
            Ok(_) => {
                info!("Verification email sent successfully to: {}", email);
                Ok(())
            }
            Err(e) => {
                error!("Failed to send verification email to {}: {:?}", email, e);
                Err(AuthError::InternalError)
            }
        }
    }

    /// Create HTML content for verification email
    fn create_verification_email_html(&self, username: &str, verification_url: &str) -> String {
        format!(
            r#"
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Verify Your Email - LunarBase</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; background-color: #101010; padding: 20px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #101010; padding: 20px;">
        <tr>
            <td align="center">
                <!-- Main Container -->
                <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width: 600px; background-color: #171717; border-radius: 16px; box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4), 0 4px 8px rgba(0, 0, 0, 0.2); overflow: hidden; border: 1px solid #3a3a3a;">
                    
                    <!-- Header -->
                    <tr>
                        <td style="background-color: #1C1C1C; padding: 40px 30px; text-align: center; border-bottom: 1px solid #3a3a3a;">
                            
                            <!-- Logo Container -->
                            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                                <tr>
                                    <td align="center">
                                        <!-- Logo -->
                                        <div style="width: 64px; height: 64px; background-color: #3a3a3a; border-radius: 16px; display: inline-block; line-height: 64px; text-align: center; margin-bottom: 16px; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3); border: 1px solid #4a4a4a;">
                                            <img src="https://raw.githubusercontent.com/66HEX/lunarbase/master/logo.png" alt="LunarBase Logo" style="width: 48px; height: 48px; vertical-align: middle; border-radius: 4px;" />
                                        </div>
                                        
                                        <!-- Brand Name -->
                                        <div style="font-size: 32px; font-weight: 700; color: #ffffff; margin-bottom: 8px; letter-spacing: -0.6px;">
                                            LunarBase
                                        </div>
                                        
                                        <!-- Tagline -->
                                        <div style="font-size: 16px; color: #b0b0b0; font-weight: 500;">
                                            Admin Panel
                                        </div>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    
                    <!-- Content -->
                    <tr>
                        <td style="padding: 40px 30px; background-color: #171717;">
                            
                            <!-- Greeting -->
                            <h1 style="font-size: 24px; font-weight: 600; color: #ffffff; margin: 0 0 16px 0; text-align: center;">
                                Welcome, {}!
                            </h1>
                            
                            <!-- Message -->
                            <p style="font-size: 16px; color: #d0d0d0; margin: 0 0 32px 0; text-align: center; line-height: 1.7;">
                                Thank you for joining LunarBase. To complete your registration and access your admin panel, 
                                please verify your email address by clicking the button below.
                            </p>
                            
                            <!-- CTA Button -->
                            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                                <tr>
                                    <td align="center" style="padding: 0 0 32px 0;">
                                        <a href="{}" style="display: inline-block; background-color: #ffffff; color: #1a1a1a; padding: 16px 32px; text-decoration: none; border-radius: 12px; font-weight: 600; font-size: 16px; letter-spacing: 0.5px; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3); border: 1px solid #e0e0e0; transition: all 0.2s ease;">
                                            Verify Email Address
                                        </a>
                                    </td>
                                </tr>
                            </table>
                            
                            <!-- Alternative Link -->
                            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #1a1a1a; border: 1px solid #3a3a3a; border-radius: 8px; margin: 0 0 24px 0;">
                                <tr>
                                    <td style="padding: 20px;">
                                        <p style="font-size: 14px; color: #b0b0b0; margin: 0 0 8px 0;">
                                            If the button doesn't work, copy and paste this link:
                                        </p>
                                        <div style="font-size: 13px; color: #d0d0d0; word-break: break-all; font-family: 'Monaco', 'Menlo', 'Courier New', monospace; background-color: #0f0f0f; padding: 12px; border-radius: 6px; border: 1px solid #3a3a3a;">
                                            {}
                                        </div>
                                    </td>
                                </tr>
                            </table>
                            
                            <!-- Expiry Notice -->
                            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #1a1a1a; border-left: 4px solid #ffa500; border-radius: 8px; margin: 0 0 24px 0; border: 1px solid #3a3a3a;">
                                <tr>
                                    <td style="padding: 16px;">
                                        <p style="font-size: 14px; color: #ffa500; font-weight: 500; margin: 0;">
                                            ⏰ This verification link will expire in 24 hours for security reasons.
                                        </p>
                                    </td>
                                </tr>
                            </table>
                            
                            <!-- Security Notice -->
                            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #1a1a1a; border-radius: 8px; border-left: 4px solid #4a4a4a; margin-top: 24px; border: 1px solid #3a3a3a;">
                                <tr>
                                    <td style="padding: 16px;">
                                        <p style="font-size: 13px; color: #b0b0b0; line-height: 1.5; margin: 0;">
                                            🔒 If you didn't create an account with LunarBase, you can safely ignore this email. 
                                            Your email address will not be used without verification.
                                        </p>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    
                    <!-- Footer -->
                    <tr>
                        <td style="background-color: #1C1C1C; padding: 30px; text-align: center; border-top: 1px solid #3a3a3a;">
                            <p style="font-size: 14px; color: #b0b0b0; margin: 0 0 8px 0;">
                                This email was sent by LunarBase Admin System.
                            </p>
                            <p style="font-size: 14px; color: #b0b0b0; margin: 0 0 16px 0;">
                                Need help? Contact your system administrator.
                            </p>
                            <p style="font-size: 12px; color: #888888; margin: 0;">
                                © 2025 LunarBase. All rights reserved.
                            </p>
                        </td>
                    </tr>
                    
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
            "#,
            username, verification_url, verification_url
        )
    }

    /// Create plain text content for verification email
    fn create_verification_email_text(&self, username: &str, verification_url: &str) -> String {
        format!(
            r#"🌙 LunarBase Admin Panel

Welcome, {}!

Thank you for joining LunarBase. To complete your registration and access your admin panel, 
please verify your email address by visiting the following link:

{}

⏰ IMPORTANT: This verification link will expire in 24 hours for security reasons.

🔒 SECURITY NOTE: If you didn't create an account with LunarBase, you can safely ignore 
this email. Your email address will not be used without verification.

Best regards,
The LunarBase Team

---
This email was sent by LunarBase Admin System.
Need help? Contact your system administrator.

© 2025 LunarBase. All rights reserved."#,
            username, verification_url
        )
    }

    /// Check if email service is configured
    pub fn is_configured(&self) -> bool {
        self.resend_client.is_some()
    }

    pub fn get_frontend_url(&self) -> &str {
        &self.frontend_url
    }
}