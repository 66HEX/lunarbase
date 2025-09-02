# LunarBase EC2 Deployment Guide (Without Nginx)

This guide explains how to deploy LunarBase directly on an EC2 instance without using a reverse proxy like Nginx. LunarBase's built-in server can handle TLS termination and HTTP-to-HTTPS redirects natively.

## Prerequisites

- AWS EC2 instance (Ubuntu 20.04+ or Amazon Linux 2 recommended)
- Domain name pointing to your EC2 instance
- SSL certificate for your domain
- Basic knowledge of Linux system administration

## Step 1: Prepare Your EC2 Instance

### 1.1 Launch EC2 Instance

1. Launch an EC2 instance with at least:
   - **Instance Type**: t3.small or larger
   - **Storage**: 20GB+ EBS volume
   - **Security Group**: Allow ports 22 (SSH), 80 (HTTP), and 443 (HTTPS)

### 1.2 Configure Security Group

```bash
# Allow SSH (port 22)
# Allow HTTP (port 80) - for redirects
# Allow HTTPS (port 443) - for main application
```

### 1.3 Connect to Your Instance

```bash
ssh -i your-key.pem ubuntu@your-ec2-public-ip
```

## Step 2: Install Dependencies

### 2.1 Update System

```bash
sudo apt update && sudo apt upgrade -y
```

### 2.2 Install Required Packages

```bash
# Install essential tools
sudo apt install -y curl wget unzip build-essential pkg-config libssl-dev

# Install Rust (if building from source)
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source ~/.cargo/env
```

## Step 3: Obtain SSL Certificate

### Option A: Using Let's Encrypt (Recommended)

```bash
# Install Certbot
sudo apt install -y certbot

# Obtain certificate (replace your-domain.com)
sudo certbot certonly --standalone -d your-domain.com

# Certificates will be saved to:
# /etc/letsencrypt/live/your-domain.com/fullchain.pem
# /etc/letsencrypt/live/your-domain.com/privkey.pem
```

### Option B: Upload Your Own Certificate

```bash
# Create SSL directory
sudo mkdir -p /etc/ssl/certs /etc/ssl/private

# Upload your certificate files
sudo cp your-domain.crt /etc/ssl/certs/
sudo cp your-domain.key /etc/ssl/private/

# Set proper permissions
sudo chmod 644 /etc/ssl/certs/your-domain.crt
sudo chmod 600 /etc/ssl/private/your-domain.key
```

## Step 4: Deploy LunarBase

### 4.1 Create Application Directory

```bash
sudo mkdir -p /opt/lunarbase
sudo chown $USER:$USER /opt/lunarbase
cd /opt/lunarbase
```

### 4.2 Upload or Build LunarBase Binary

**Option A: Upload Pre-built Binary**
```bash
# Upload your lunarbase binary to /opt/lunarbase/
scp -i your-key.pem ./lunarbase ubuntu@your-ec2-ip:/opt/lunarbase/
chmod +x /opt/lunarbase/lunarbase
```

**Option B: Build from Source**
```bash
# Clone repository
git clone https://github.com/66HEX/lunarbase.git .

# Build release binary
cargo build --release

# Copy binary
cp target/release/lunarbase /opt/lunarbase/
```

### 4.3 Create Database Directory

```bash
sudo mkdir -p /var/lib/lunarbase
sudo chown $USER:$USER /var/lib/lunarbase
```

### 4.4 Configure Environment

```bash
# Copy and customize production config
cp .env.production .env

# Edit configuration
nano .env
```

Update the following values in `.env`:
```bash
# Database
DATABASE_URL=/var/lib/lunarbase/production.db
SQLCIPHER_KEY=your-strong-encryption-key

# Security
JWT_SECRET=your-jwt-secret
PASSWORD_PEPPER=your-password-pepper

# Application
FRONTEND_URL=https://your-domain.com

# TLS Certificates
TLS_CERT_PATH=/etc/letsencrypt/live/your-domain.com/fullchain.pem
TLS_KEY_PATH=/etc/letsencrypt/live/your-domain.com/privkey.pem

# Admin user
LUNARBASE_ADMIN_EMAIL=admin@your-domain.com
LUNARBASE_ADMIN_USERNAME=admin
LUNARBASE_ADMIN_PASSWORD=your-secure-password

# Email (optional)
RESEND_API_KEY=your-resend-api-key
EMAIL_FROM=noreply@your-domain.com

# S3 (optional)
S3_BUCKET_NAME=your-bucket
S3_REGION=us-east-1
S3_ACCESS_KEY_ID=your-access-key
S3_SECRET_ACCESS_KEY=your-secret-key
```

## Step 5: Create Systemd Service

### 5.1 Create Service File

```bash
sudo nano /etc/systemd/system/lunarbase.service
```

```ini
[Unit]
Description=LunarBase Database Management Platform
After=network.target
Wants=network.target

[Service]
Type=simple
User=ubuntu
Group=ubuntu
WorkingDirectory=/opt/lunarbase
EnvironmentFile=/opt/lunarbase/.env
ExecStart=/opt/lunarbase/lunarbase serve \
    --host 0.0.0.0 \
    --port 443 \
    --enable-redirect \
    --redirect-port 80 \
    --force-tls \
    --enable-compression \
    --hsts-max-age 31536000 \
    --csp-policy "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:;" \
    --x-frame-options DENY
Restart=always
RestartSec=10
KillMode=mixed
KillSignal=SIGTERM
TimeoutStopSec=30

# Security settings
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/var/lib/lunarbase /opt/lunarbase

# Allow binding to privileged ports (80, 443)
AmbientCapabilities=CAP_NET_BIND_SERVICE
CapabilityBoundingSet=CAP_NET_BIND_SERVICE

[Install]
WantedBy=multi-user.target
```

### 5.2 Enable and Start Service

```bash
# Reload systemd
sudo systemctl daemon-reload

# Enable service to start on boot
sudo systemctl enable lunarbase

# Start service
sudo systemctl start lunarbase

# Check status
sudo systemctl status lunarbase
```

## Step 6: Configure Automatic Certificate Renewal

### 6.1 Create Renewal Hook (Let's Encrypt)

```bash
sudo nano /etc/letsencrypt/renewal-hooks/deploy/lunarbase-reload.sh
```

```bash
#!/bin/bash
# Reload LunarBase after certificate renewal
systemctl reload lunarbase
```

```bash
sudo chmod +x /etc/letsencrypt/renewal-hooks/deploy/lunarbase-reload.sh
```

### 6.2 Test Certificate Renewal

```bash
sudo certbot renew --dry-run
```

## Step 7: Configure Firewall (Optional)

```bash
# Install UFW
sudo apt install -y ufw

# Configure firewall rules
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Enable firewall
sudo ufw enable
```

## Step 8: Set Up Monitoring and Logging

### 8.1 View Logs

```bash
# View service logs
sudo journalctl -u lunarbase -f

# View recent logs
sudo journalctl -u lunarbase --since "1 hour ago"
```

### 8.2 Log Rotation

```bash
sudo nano /etc/logrotate.d/lunarbase
```

```
/var/log/lunarbase/*.log {
    daily
    missingok
    rotate 52
    compress
    delaycompress
    notifempty
    create 644 ubuntu ubuntu
    postrotate
        systemctl reload lunarbase
    endscript
}
```

## Step 9: Backup Strategy

### 9.1 Database Backup Script

```bash
nano /opt/lunarbase/backup.sh
```

```bash
#!/bin/bash
BACKUP_DIR="/var/backups/lunarbase"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR

# Backup database
cp /var/lib/lunarbase/production.db $BACKUP_DIR/lunarbase_$DATE.db

# Keep only last 7 days of backups
find $BACKUP_DIR -name "lunarbase_*.db" -mtime +7 -delete

echo "Backup completed: lunarbase_$DATE.db"
```

```bash
chmod +x /opt/lunarbase/backup.sh
```

### 9.2 Schedule Backups

```bash
crontab -e
```

Add:
```
# Daily backup at 2 AM
0 2 * * * /opt/lunarbase/backup.sh
```

## Step 10: Access Your Application

1. **Main Application**: `https://your-domain.com`
2. **Admin Panel**: `https://your-domain.com/admin`
3. **API Documentation**: `https://your-domain.com/docs`
4. **Health Check**: `https://your-domain.com/health`

## Troubleshooting

### Common Issues

1. **Permission Denied on Ports 80/443**
   ```bash
   # Ensure CAP_NET_BIND_SERVICE is set in systemd service
   # Or run with sudo (not recommended)
   ```

2. **Certificate Issues**
   ```bash
   # Check certificate paths
   sudo ls -la /etc/letsencrypt/live/your-domain.com/
   
   # Verify certificate validity
   openssl x509 -in /etc/letsencrypt/live/your-domain.com/fullchain.pem -text -noout
   ```

3. **Database Connection Issues**
   ```bash
   # Check database file permissions
   ls -la /var/lib/lunarbase/
   
   # Check if directory is writable
   touch /var/lib/lunarbase/test && rm /var/lib/lunarbase/test
   ```

4. **Service Won't Start**
   ```bash
   # Check service logs
   sudo journalctl -u lunarbase -n 50
   
   # Test binary manually
   cd /opt/lunarbase
   ./lunarbase serve --help
   ```

### Performance Tuning

1. **Increase File Limits**
   ```bash
   # Add to /etc/security/limits.conf
   ubuntu soft nofile 65536
   ubuntu hard nofile 65536
   ```

2. **Optimize Database**
   ```bash
   # Consider using connection pooling settings in application
   # Monitor database performance with built-in metrics
   ```

## Security Considerations

1. **Regular Updates**
   - Keep your EC2 instance updated
   - Update LunarBase regularly
   - Monitor security advisories

2. **Access Control**
   - Use strong passwords
   - Enable 2FA where possible
   - Regularly audit user access

3. **Network Security**
   - Use security groups effectively
   - Consider VPC configuration
   - Monitor access logs

4. **Data Protection**
   - Enable database encryption (SQLCipher)
   - Regular backups
   - Test backup restoration

## Scaling Considerations

- **Vertical Scaling**: Upgrade EC2 instance type
- **Load Balancing**: Use Application Load Balancer for multiple instances
- **Database**: Consider RDS for managed database solution
- **CDN**: Use CloudFront for static assets
- **Monitoring**: Implement CloudWatch or similar monitoring

This deployment provides a production-ready, self-contained LunarBase installation that handles all traffic directly without requiring additional reverse proxy configuration.