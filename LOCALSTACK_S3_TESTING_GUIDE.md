# LocalStack S3 Testing Guide

This guide describes how to test S3 file upload functionality in Lunarbase using LocalStack for local testing.

## Prerequisites

- Docker and Docker Compose installed on your system
- AWS CLI installed (optional, for testing)
- Lunarbase backend with implemented S3Service
- Existing `docker-compose.localstack.yml` file
- Environment variables already configured

## 1. Start LocalStack

### Launch LocalStack:

```bash
# Start LocalStack in the background
docker-compose -f docker-compose.localstack.yml up -d

# Check if LocalStack is running
curl http://localhost:4566/health
```

## 2. Environment Variables

Ensure your `.env` file contains the following S3 configuration:

```bash
# ===========================================
# LOCALSTACK S3 CONFIGURATION
# ===========================================
S3_ENDPOINT_URL=http://localhost:4566
S3_BUCKET_NAME=lunarbase-test-bucket
S3_REGION=us-east-1
S3_ACCESS_KEY_ID=test
S3_SECRET_ACCESS_KEY=test
```

## 3. Initialize S3 Bucket

### Option A: Using AWS CLI

```bash
# Configure AWS CLI for LocalStack
export AWS_ACCESS_KEY_ID=test
export AWS_SECRET_ACCESS_KEY=test
export AWS_DEFAULT_REGION=us-east-1

# Create bucket
aws --endpoint-url=http://localhost:4566 s3 mb s3://lunarbase-test-bucket

# Verify bucket was created
aws --endpoint-url=http://localhost:4566 s3 ls
```

### Option B: Using curl

```bash
# Create bucket via REST API
curl -X PUT "http://localhost:4566/lunarbase-test-bucket" \
  -H "Authorization: AWS test:test" \
  -H "Content-Type: application/xml"

# Check bucket list
curl "http://localhost:4566/" \
  -H "Authorization: AWS test:test"
```

### Option C: Automatic initialization via script

Create file `scripts/init-localstack.sh`:

```bash
#!/bin/bash

echo "Initializing LocalStack S3..."

# Wait until LocalStack is ready
echo "Waiting for LocalStack..."
while ! curl -s http://localhost:4566/health > /dev/null; do
  sleep 1
done

echo "LocalStack is ready!"

# Create bucket
echo "Creating bucket lunarbase-test-bucket..."
aws --endpoint-url=http://localhost:4566 s3 mb s3://lunarbase-test-bucket

echo "Checking bucket..."
aws --endpoint-url=http://localhost:4566 s3 ls

echo "LocalStack S3 is ready for testing!"
```

Make executable and run:

```bash
chmod +x scripts/init-localstack.sh
./scripts/init-localstack.sh
```

## 4. Running Backend with LocalStack

```bash
# Option A: Using environment file
# Ensure your .env file has the LocalStack S3 configuration
cargo run

# Option B: Setting variables directly
S3_ENDPOINT_URL=http://localhost:4566 \
S3_BUCKET_NAME=lunarbase-test-bucket \
S3_REGION=us-east-1 \
S3_ACCESS_KEY_ID=test \
S3_SECRET_ACCESS_KEY=test \
cargo run
```

## 5. Testing Functionality

### Test 1: Check S3 Health

```bash
# Backend should log on startup:
# "S3Service initialized successfully"
# Check backend logs
```

### Test 2: File Upload via API

```bash
# First create a collection with file field
curl -X POST "http://localhost:3000/api/collections" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "name": "test-collection",
    "schema": {
      "name": {"type": "text", "required": true},
      "avatar": {"type": "file", "required": false}
    }
  }'

# Then upload a record with file
curl -X POST "http://localhost:3000/api/collections/test-collection/records" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -F 'data={"name": "Test Record"}' \
  -F 'file_avatar=@/path/to/test/file.jpg'
```

### Test 3: Check Files in LocalStack

```bash
# List files in bucket
aws --endpoint-url=http://localhost:4566 s3 ls s3://lunarbase-test-bucket/

# Download file
aws --endpoint-url=http://localhost:4566 s3 cp s3://lunarbase-test-bucket/FILENAME ./downloaded-file
```

### Test 4: Run Integration Tests

```bash
# Run tests with LocalStack configuration
S3_ENDPOINT_URL=http://localhost:4566 \
S3_BUCKET_NAME=lunarbase-test-bucket \
S3_REGION=us-east-1 \
S3_ACCESS_KEY_ID=test \
S3_SECRET_ACCESS_KEY=test \
cargo test file_upload_integration_tests --test-threads=1
```

## 6. Debugging

### Check LocalStack logs:

```bash
docker logs lunarbase-localstack
```

### Check LocalStack status:

```bash
curl http://localhost:4566/health
```

### Check bucket contents:

```bash
# Via AWS CLI
aws --endpoint-url=http://localhost:4566 s3 ls s3://lunarbase-test-bucket/ --recursive

# Via curl
curl "http://localhost:4566/lunarbase-test-bucket/" \
  -H "Authorization: AWS test:test"
```

### Check backend logs:

Verify that backend logs:
- `S3Service initialized successfully` - on startup
- `Uploading file to S3` - during upload
- `File uploaded successfully` - after successful upload

## 7. Cleanup

### Stop LocalStack:

```bash
docker-compose -f docker-compose.localstack.yml down
```

### Remove LocalStack data:

```bash
docker-compose -f docker-compose.localstack.yml down -v
sudo rm -rf /tmp/localstack
```

## 8. Troubleshooting

### Problem: "Bucket does not exist"
**Solution**: Ensure the bucket was created before starting the backend.

### Problem: "Connection refused"
**Solution**: Check if LocalStack is running on port 4566.

### Problem: "Access Denied"
**Solution**: Check AWS credentials configuration (test/test).

### Problem: "S3Service initialization failed"
**Solution**: Check S3 environment variables and LocalStack availability.

## 9. Useful Commands

```bash
# Restart LocalStack
docker-compose -f docker-compose.localstack.yml restart

# Check all containers
docker ps

# Check ports
netstat -tulpn | grep 4566

# Check environment variables
env | grep S3
```

## 10. CI/CD Integration

For automated testing, you can add LocalStack to your pipeline:

```yaml
# Example for GitHub Actions
services:
  localstack:
    image: localstack/localstack:latest
    ports:
      - 4566:4566
    env:
      SERVICES: s3
      DEBUG: 1
      AWS_DEFAULT_REGION: us-east-1
      AWS_ACCESS_KEY_ID: test
      AWS_SECRET_ACCESS_KEY: test
```

This guide should enable complete testing of S3 functionality in a local environment without needing to use real AWS S3.