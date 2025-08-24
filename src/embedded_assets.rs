use rust_embed::RustEmbed;
use std::borrow::Cow;
use std::collections::HashMap;

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

pub struct MimeTypeMap {
    types: HashMap<&'static str, &'static str>,
}

impl MimeTypeMap {
    pub fn new() -> Self {
        let mut types = HashMap::new();

        types.insert("html", "text/html; charset=utf-8");
        types.insert("css", "text/css; charset=utf-8");
        types.insert("js", "application/javascript; charset=utf-8");
        types.insert("json", "application/json; charset=utf-8");

        types.insert("ico", "image/x-icon");
        types.insert("png", "image/png");
        types.insert("jpg", "image/jpeg");
        types.insert("jpeg", "image/jpeg");
        types.insert("gif", "image/gif");
        types.insert("svg", "image/svg+xml");
        types.insert("webp", "image/webp");

        types.insert("woff", "font/woff");
        types.insert("woff2", "font/woff2");
        types.insert("ttf", "font/ttf");
        types.insert("eot", "application/vnd.ms-fontobject");
        types.insert("otf", "font/otf");

        Self { types }
    }

    pub fn get_mime_type(&self, file_path: &str) -> &'static str {
        if let Some(extension) = file_path.split('.').last() {
            self.types
                .get(extension.to_lowercase().as_str())
                .copied()
                .unwrap_or("application/octet-stream")
        } else {
            "application/octet-stream"
        }
    }
}

impl AdminAssets {
    pub fn get_asset_with_fallback(path: &str) -> Option<Cow<'static, [u8]>> {
        if let Some(asset) = Self::get(path) {
            return Some(asset.data);
        }

        if !path.starts_with("api/") && !path.contains('.') {
            if let Some(index) = Self::get("admin/index.html") {
                return Some(index.data);
            }
        }

        None
    }

    pub fn is_available() -> bool {
        Self::get("admin/index.html").is_some()
    }

    pub fn list_assets() -> Vec<String> {
        Self::iter().map(|path| path.to_string()).collect()
    }

    pub fn get_asset_with_mime(path: &str) -> Option<(Cow<'static, [u8]>, &'static str)> {
        let mime_map = MimeTypeMap::new();

        if let Some(asset) = Self::get(path) {
            let mime_type = mime_map.get_mime_type(path);
            return Some((asset.data, mime_type));
        }

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

        assert_eq!(
            mime_map.get_mime_type("index.html"),
            "text/html; charset=utf-8"
        );
        assert_eq!(
            mime_map.get_mime_type("style.css"),
            "text/css; charset=utf-8"
        );
        assert_eq!(
            mime_map.get_mime_type("app.js"),
            "application/javascript; charset=utf-8"
        );
        assert_eq!(mime_map.get_mime_type("favicon.ico"), "image/x-icon");
        assert_eq!(mime_map.get_mime_type("font.woff2"), "font/woff2");
        assert_eq!(
            mime_map.get_mime_type("unknown.xyz"),
            "application/octet-stream"
        );
    }

    #[test]
    fn test_asset_availability() {
        println!("Assets available: {}", AdminAssets::is_available());
        println!("Available assets: {:?}", AdminAssets::list_assets());
    }
}
