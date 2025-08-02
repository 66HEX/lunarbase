#!/bin/bash

# Colors for better readability
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🛑 Stopping LocalStack...${NC}"

# Function to check if command succeeded
check_command() {
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ $1 - success${NC}"
    else
        echo -e "${YELLOW}⚠️  $1 - warning (may already be stopped)${NC}"
    fi
}

# Stop LocalStack
echo -e "${YELLOW}📦 Stopping LocalStack containers...${NC}"
docker-compose -f docker-compose.localstack.yml down
check_command "Stopping LocalStack"

# Optional: remove volumes (uncomment if you want to clean data)
echo -e "${YELLOW}🗑️  Do you want to remove LocalStack data? (y/N)${NC}"
read -r response
if [[ "$response" =~ ^([yY][eE][sS]|[yY])$ ]]; then
    echo -e "${YELLOW}🧹 Removing LocalStack data...${NC}"
    docker-compose -f docker-compose.localstack.yml down -v
    sudo rm -rf /tmp/localstack 2>/dev/null || true
    check_command "Removing LocalStack data"
fi

echo -e "${GREEN}✅ LocalStack has been stopped${NC}"
echo -e "${BLUE}📋 To start the project again:${NC}"
echo -e "  ${GREEN}./start-with-localstack.sh${NC}"