use axum::{extract::ConnectInfo, http::HeaderMap};
use std::net::{IpAddr, SocketAddr};
use tracing::debug;

pub fn extract_client_ip(
    headers: &HeaderMap,
    connect_info: Option<ConnectInfo<SocketAddr>>,
) -> String {
    if let Some(forwarded_for) = headers.get("x-forwarded-for").and_then(|h| h.to_str().ok()) {
        let client_ip = forwarded_for.split(',').next().unwrap_or("").trim();

        if !client_ip.is_empty() && is_valid_ip(client_ip) {
            debug!("Client IP from X-Forwarded-For: {}", client_ip);
            return client_ip.to_string();
        }
    }

    if let Some(real_ip) = headers.get("x-real-ip").and_then(|h| h.to_str().ok()) {
        if is_valid_ip(real_ip) {
            debug!("Client IP from X-Real-IP: {}", real_ip);
            return real_ip.to_string();
        }
    }

    if let Some(cf_ip) = headers
        .get("cf-connecting-ip")
        .and_then(|h| h.to_str().ok())
    {
        if is_valid_ip(cf_ip) {
            debug!("Client IP from CF-Connecting-IP: {}", cf_ip);
            return cf_ip.to_string();
        }
    }

    if let Some(client_ip) = headers.get("x-client-ip").and_then(|h| h.to_str().ok()) {
        if is_valid_ip(client_ip) {
            debug!("Client IP from X-Client-IP: {}", client_ip);
            return client_ip.to_string();
        }
    }

    if let Some(ConnectInfo(socket_addr)) = connect_info {
        let ip = socket_addr.ip().to_string();
        debug!("Client IP from ConnectInfo: {}", ip);
        return ip;
    }

    debug!("Could not determine client IP, using 'unknown'");
    "unknown".to_string()
}

fn is_valid_ip(ip_str: &str) -> bool {
    ip_str.parse::<IpAddr>().is_ok()
}

pub fn get_rate_limit_key(
    headers: &HeaderMap,
    connect_info: Option<ConnectInfo<SocketAddr>>,
    prefix: &str,
) -> String {
    let client_ip = extract_client_ip(headers, connect_info);
    format!("{}:{}", prefix, client_ip)
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::http::HeaderMap;
    use std::net::{IpAddr, Ipv4Addr, SocketAddr};

    #[test]
    fn test_extract_from_x_forwarded_for() {
        let mut headers = HeaderMap::new();
        headers.insert("x-forwarded-for", "192.168.1.1, 10.0.0.1".parse().unwrap());

        let ip = extract_client_ip(&headers, None);
        assert_eq!(ip, "192.168.1.1");
    }

    #[test]
    fn test_extract_from_x_real_ip() {
        let mut headers = HeaderMap::new();
        headers.insert("x-real-ip", "203.0.113.1".parse().unwrap());

        let ip = extract_client_ip(&headers, None);
        assert_eq!(ip, "203.0.113.1");
    }

    #[test]
    fn test_extract_from_connect_info() {
        let headers = HeaderMap::new();
        let socket_addr = SocketAddr::new(IpAddr::V4(Ipv4Addr::new(127, 0, 0, 1)), 8080);
        let connect_info = Some(ConnectInfo(socket_addr));

        let ip = extract_client_ip(&headers, connect_info);
        assert_eq!(ip, "127.0.0.1");
    }

    #[test]
    fn test_fallback_to_unknown() {
        let headers = HeaderMap::new();

        let ip = extract_client_ip(&headers, None);
        assert_eq!(ip, "unknown");
    }

    #[test]
    fn test_is_valid_ip() {
        assert!(is_valid_ip("192.168.1.1"));
        assert!(is_valid_ip("::1"));
        assert!(!is_valid_ip("not-an-ip"));
        assert!(!is_valid_ip(""));
    }

    #[test]
    fn test_rate_limit_key() {
        let mut headers = HeaderMap::new();
        headers.insert("x-forwarded-for", "192.168.1.1".parse().unwrap());

        let key = get_rate_limit_key(&headers, None, "login");
        assert_eq!(key, "login:192.168.1.1");
    }
}
