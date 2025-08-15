use rust_embed::RustEmbed;
use std::borrow::Cow;
use std::collections::HashMap;

/// Embedded frontend assets from admin-ui/dist
#[derive(RustEmbed)]
#[folder = "admin-ui/dist/"]
#[prefix = "admin/"]
#[include = "*.html"]
#[include = "*.js"]
#[include = "*.css"]
#[include = "*.ico"]
#[include = "*.png"]
#[include = "*.svg"]
#[include = "*.woff"]
#[include = "*.woff2"]
#[include = "*.ttf"]
#[include = "*.eot"]
#[exclude = "*.map"]
pub struct AdminAssets;

/// MIME type mapping for embedded assets
pub struct MimeTypeMap {
    types: HashMap<&'static str, &'static str>,
}

impl MimeTypeMap {
    pub fn new() -> Self {
        let mut types = HashMap::new();
        
        // Web assets
        types.insert("html", "text/html; charset=utf-8");
        types.insert("css", "text/css; charset=utf-8");
        types.insert("js", "application/javascript; charset=utf-8");
        types.insert("json", "application/json; charset=utf-8");
        
        // Images
        types.insert("ico", "image/x-icon");
        types.insert("png", "image/png");
        types.insert("jpg", "image/jpeg");
        types.insert("jpeg", "image/jpeg");
        types.insert("gif", "image/gif");
        types.insert("svg", "image/svg+xml");
        types.insert("webp", "image/webp");
        
        // Fonts
        types.insert("woff", "font/woff");
        types.insert("woff2", "font/woff2");
        types.insert("ttf", "font/ttf");
        types.insert("eot", "application/vnd.ms-fontobject");
        types.insert("otf", "font/otf");
        
        Self { types }
    }
    
    pub fn get_mime_type(&self, file_path: &str) -> &'static str {
        if let Some(extension) = file_path.split('.').last() {
            self.types.get(extension.to_lowercase().as_str())
                .copied()
                .unwrap_or("application/octet-stream")
        } else {
            "application/octet-stream"
        }
    }
}

/// Helper functions for working with embedded assets
impl AdminAssets {
    /// Get an asset by path, with fallback to index.html for SPA routing
    pub fn get_asset_with_fallback(path: &str) -> Option<Cow<'static, [u8]>> {
        // Try to get the exact asset first
        if let Some(asset) = Self::get(path) {
            return Some(asset.data);
        }
        
        // For SPA routing, fallback to index.html for non-API routes
        if !path.starts_with("api/") && !path.contains('.') {
            if let Some(index) = Self::get("admin/index.html") {
                return Some(index.data);
            }
        }
        
        None
    }
    
    /// Check if the embedded assets are available (useful for development)
    pub fn is_available() -> bool {
        Self::get("admin/index.html").is_some()
    }
    
    /// Get all asset paths (useful for debugging)
    pub fn list_assets() -> Vec<String> {
        Self::iter().map(|path| path.to_string()).collect()
    }
    
    /// Get asset with proper MIME type
    pub fn get_asset_with_mime(path: &str) -> Option<(Cow<'static, [u8]>, &'static str)> {
        let mime_map = MimeTypeMap::new();
        
        // Try to get the exact asset first
        if let Some(asset) = Self::get(path) {
            let mime_type = mime_map.get_mime_type(path);
            return Some((asset.data, mime_type));
        }
        
        // For SPA routing, fallback to index.html for non-API routes
        if !path.starts_with("api/") && !path.contains('.') {
            if let Some(index) = Self::get("admin/index.html") {
                return Some((index.data, "text/html"));
            }
        }
        
        None
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_mime_type_mapping() {
        let mime_map = MimeTypeMap::new();
        
        assert_eq!(mime_map.get_mime_type("index.html"), "text/html; charset=utf-8");
        assert_eq!(mime_map.get_mime_type("style.css"), "text/css; charset=utf-8");
        assert_eq!(mime_map.get_mime_type("app.js"), "application/javascript; charset=utf-8");
        assert_eq!(mime_map.get_mime_type("favicon.ico"), "image/x-icon");
        assert_eq!(mime_map.get_mime_type("font.woff2"), "font/woff2");
        assert_eq!(mime_map.get_mime_type("unknown.xyz"), "application/octet-stream");
    }
    
    #[test]
    fn test_asset_availability() {
        // This test will pass in release builds with embedded assets
        // and may fail in debug builds without assets
        println!("Assets available: {}", AdminAssets::is_available());
        println!("Available assets: {:?}", AdminAssets::list_assets());
    }
}