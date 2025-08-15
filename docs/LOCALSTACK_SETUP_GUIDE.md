# LocalStack Scripts

This directory contains scripts to easily manage LocalStack for S3 testing with Lunarbase.

## Scripts Overview

### `start-with-localstack.sh`

Automatically sets up and starts the complete LocalStack environment for Lunarbase development.

**What it does:**
1. Starts LocalStack using Docker Compose
2. Waits for LocalStack to be ready
3. Configures AWS CLI with test credentials
4. Creates the required S3 bucket (`lunarbase-test-bucket`)
5. Verifies the bucket was created successfully
6. Checks and updates `.env` file with LocalStack S3 configuration
7. Provides instructions for next steps

**Usage:**
```bash
./start-with-localstack.sh
```

**Requirements:**
- Docker and Docker Compose installed
- AWS CLI installed
- Existing `docker-compose.localstack.yml` file
- `.env` file (will be created/updated automatically)

### `stop-localstack.sh`

Stops LocalStack and optionally cleans up data.

**What it does:**
1. Stops LocalStack containers
2. Optionally removes LocalStack data and volumes
3. Provides instructions to restart

**Usage:**
```bash
./stop-localstack.sh
```

## Quick Start

1. **Start the environment:**
   ```bash
   ./start-with-localstack.sh
   ```

2. **Start the backend:**
   ```bash
   cargo run
   ```

3. **Run integration tests:**
   ```bash
   cargo test file_upload_integration_tests --test-threads=1
   ```

4. **Stop LocalStack when done:**
   ```bash
   ./stop-localstack.sh
   ```

## Environment Configuration

The scripts automatically configure your `.env` file with the following LocalStack S3 settings:

```bash
S3_ENDPOINT_URL=http://localhost:4566
S3_BUCKET_NAME=lunarbase-test-bucket
S3_REGION=us-east-1
S3_ACCESS_KEY_ID=test
S3_SECRET_ACCESS_KEY=test
```

## Troubleshooting

### LocalStack won't start
- Check if Docker is running
- Ensure port 4566 is not in use by another service
- Check Docker Compose file exists: `docker-compose.localstack.yml`

### AWS CLI commands fail
- Ensure AWS CLI is installed: `aws --version`
- Check if LocalStack is running: `curl http://localhost:4566/health`
- Verify environment variables are set correctly

### Backend can't connect to S3
- Ensure LocalStack is running and healthy
- Check `.env` file has correct S3 configuration
- Verify the bucket exists: `aws --endpoint-url=http://localhost:4566 s3 ls`

### Permission denied when running scripts
- Make scripts executable: `chmod +x *.sh`

## Manual Commands

If you prefer to run commands manually, here are the key steps:

```bash
# Start LocalStack
docker-compose -f docker-compose.localstack.yml up -d

# Configure AWS CLI
export AWS_ACCESS_KEY_ID=test
export AWS_SECRET_ACCESS_KEY=test
export AWS_DEFAULT_REGION=us-east-1

# Create bucket
aws --endpoint-url=http://localhost:4566 s3 mb s3://lunarbase-test-bucket

# Verify bucket
aws --endpoint-url=http://localhost:4566 s3 ls

# Stop LocalStack
docker-compose -f docker-compose.localstack.yml down
```