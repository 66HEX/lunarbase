# TLS/SSL Configuration Guide for HTTP/2

This guide will help you configure TLS/SSL certificates needed to run the LunarBase server with HTTP/2 support.

## Certificate Options

### 1. Self-signed certificates (development only)

```bash
# Create directory for certificates
mkdir -p certs

# Generate private key
openssl genrsa -out certs/localhost-key.pem 2048

# Generate self-signed certificate
openssl req -new -x509 -key certs/localhost-key.pem -out certs/localhost.pem -days 365 -subj "/CN=localhost"
```

### 2. Let's Encrypt (production)

```bash
# Install certbot
sudo apt-get install certbot  # Ubuntu/Debian
brew install certbot          # macOS

# Generate certificate for domain
sudo certbot certonly --standalone -d yourdomain.com

# Certificates will be available at:
# /etc/letsencrypt/live/yourdomain.com/fullchain.pem
# /etc/letsencrypt/live/yourdomain.com/privkey.pem
```

### 3. CA provider certificates (production)

Use certificates issued by a trusted certificate authority.

## Environment Variables Configuration

### For self-signed certificates (development):

```bash
ENABLE_TLS=true
ENABLE_HTTP2=true
TLS_CERT_PATH=./certs/localhost.pem
TLS_KEY_PATH=./certs/localhost-key.pem
```

### For Let's Encrypt (production):

```bash
ENABLE_TLS=true
ENABLE_HTTP2=true
TLS_CERT_PATH=/etc/letsencrypt/live/yourdomain.com/fullchain.pem
TLS_KEY_PATH=/etc/letsencrypt/live/yourdomain.com/privkey.pem
```

## Testing Configuration

### 1. Check if server starts with TLS:

```bash
cargo run
```

You should see in the logs:
```
TLS enabled - starting HTTPS server with HTTP/2 support
```

### 2. Test HTTP/2 connection:

```bash
# Check HTTP/2 protocol
curl -I --http2 -k https://localhost:3000/api/health

# Check certificate
openssl s_client -connect localhost:3000 -servername localhost
```

### 3. Check HTTP/2 metrics:

```bash
curl -k https://localhost:3000/metrics | grep http2
curl -k https://localhost:3000/metrics | grep tls
```

## Troubleshooting

### Problem: "TLS_CERT_PATH is required when TLS is enabled"
**Solution:** Make sure the `TLS_CERT_PATH` and `TLS_KEY_PATH` variables are set in the `.env` file.

### Problem: "Failed to open certificate file"
**Solution:** Check if the certificate file paths are correct and the files exist.

### Problem: "No certificates found in certificate file"
**Solution:** Check the certificate format - it must be in PEM format.

### Problem: Browser shows certificate warning
**Solution:** This is normal for self-signed certificates. In production, use certificates from a trusted CA.

## Automatic Let's Encrypt Certificate Renewal

```bash
# Add automatic renewal to crontab
sudo crontab -e

# Add line (renews certificates daily at 2:00 AM)
0 2 * * * /usr/bin/certbot renew --quiet && systemctl restart lunarbase
```

## Security

1. **Never commit private keys to the repository**
2. **Use strong permissions for certificate files:**
   ```bash
   chmod 600 certs/localhost-key.pem
   chmod 644 certs/localhost.pem
   ```
3. **In production, use only certificates from trusted CAs**
4. **Regularly renew certificates**

## HTTP/2 Verification

After starting the server with TLS, you can verify that HTTP/2 is working:

1. **In browser:** Open developer tools → Network → check "Protocol" column
2. **Curl:** `curl -I --http2 -k https://localhost:3000/api/health`
3. **Metrics:** `curl -k https://localhost:3000/metrics/summary` - check `http2_connections_active`