#!/bin/bash

# Colors for better readability
RED='\033[0;91m'
GREEN='\033[0;92m'
YELLOW='\033[0;93m'
BLUE='\033[0;94m'
GRAY='\033[0;90m'
NC='\033[0m' # No Color

echo -e "${BLUE}Starting Lunarbase with LocalStack...${NC}"

# Function to check if command succeeded
check_command() {
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}$1 - success${NC}"
    else
        echo -e "${RED}$1 - error${NC}"
        exit 1
    fi
}

# Step 1: Start LocalStack
echo -e "${YELLOW}Starting LocalStack...${NC}"
docker-compose -f docker-compose.localstack.yml up -d
check_command "Starting LocalStack"

# Step 2: Wait for LocalStack to be ready
echo -e "${YELLOW}Waiting for LocalStack to be ready...${NC}"
while ! curl -s http://localhost:4566/health > /dev/null; do
    echo "Waiting for LocalStack..."
    sleep 2
done
check_command "LocalStack is ready"

# Step 3: Configure AWS CLI
echo -e "${YELLOW}Configuring AWS CLI for LocalStack...${NC}"
export AWS_ACCESS_KEY_ID=test
export AWS_SECRET_ACCESS_KEY=test
export AWS_DEFAULT_REGION=us-east-1
check_command "AWS CLI configuration"

# Step 4: Create S3 bucket
echo -e "${YELLOW}Creating S3 bucket...${NC}"
aws --endpoint-url=http://localhost:4566 s3 mb s3://lunarbase-test-bucket
check_command "S3 bucket creation"

# Step 5: Verify bucket
echo -e "${YELLOW}Verifying bucket...${NC}"
aws --endpoint-url=http://localhost:4566 s3 ls | grep lunarbase-test-bucket
check_command "Bucket verification"

# Step 6: Check .env file
echo -e "${YELLOW}Checking .env configuration...${NC}"
if [ ! -f ".env" ]; then
    echo -e "${RED}.env file does not exist. Copy env.example to .env and configure it.${NC}"
    exit 1
fi

# Check if S3 configuration is in .env
if grep -q "S3_ENDPOINT_URL=http://localhost:4566" .env; then
    echo -e "${GREEN}LocalStack S3 configuration found in .env${NC}"
else
    echo -e "${YELLOW}Adding S3 configuration to .env...${NC}"
    echo "" >> .env
    echo "# LocalStack S3 Configuration" >> .env
    echo "S3_ENDPOINT_URL=http://localhost:4566" >> .env
    echo "S3_BUCKET_NAME=lunarbase-test-bucket" >> .env
    echo "S3_REGION=us-east-1" >> .env
    echo "S3_ACCESS_KEY_ID=test" >> .env
    echo "S3_SECRET_ACCESS_KEY=test" >> .env
fi

echo -e "${GREEN}Everything is ready!${NC}"
echo -e "${BLUE}Summary:${NC}"
echo -e "  • LocalStack is running on http://localhost:4566"
echo -e "  • S3 bucket 'lunarbase-test-bucket' has been created"
echo -e "  • .env configuration is ready"
echo ""
echo -e "${YELLOW}To start the backend, run:${NC}"
echo -e "  ${GREEN}cargo run${NC}"
echo ""
echo -e "${YELLOW}To run integration tests, run:${NC}"
echo -e "  ${GREEN}cargo test file_upload_integration_tests --test-threads=1${NC}"
echo ""
echo -e "${YELLOW}To stop LocalStack, run:${NC}"
echo -e "  ${GREEN}docker-compose -f docker-compose.localstack.yml down${NC}"