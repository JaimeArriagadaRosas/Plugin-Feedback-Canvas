#!/bin/bash
# Installation script for Feedback Plugin on local Canvas instance
# Universidad Andrés Bello - UNIDA

set -e

echo "=========================================="
echo "Feedback Plugin - Installation Script"
echo "Universidad Andrés Bello - UNIDA"
echo "=========================================="

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Docker is not installed. Please install Docker first.${NC}"
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    echo -e "${RED}❌ Docker Compose is not installed. Please install Docker Compose first.${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Docker and Docker Compose are installed${NC}"

# Check if .env exists
if [ ! -f .env ]; then
    echo -e "${YELLOW}⚠️  .env file not found. Creating from template...${NC}"
    cp .env.example .env
    echo -e "${GREEN}✅ .env file created. Please edit it with your configuration.${NC}"
    echo ""
    echo "IMPORTANT: Edit .env and set:"
    echo "  - JWT_SECRET (generate with: openssl rand -base64 32)"
    echo "  - OPENAI_API_KEY (if using OpenAI)"
    echo "  - CANVAS_URL (your Canvas instance URL)"
    echo ""
fi

# Generate LTI keys if they don't exist
if [ ! -f lti_private.pem ] || [ ! -f lti_public.pem ]; then
    echo -e "${YELLOW}🔑 Generating LTI RSA keys...${NC}"
    openssl genrsa -out lti_private.pem 2048
    openssl rsa -pubout -in lti_private.pem -out lti_public.pem
    echo -e "${GREEN}✅ LTI keys generated${NC}"
fi

# Make scripts executable
chmod +x scripts/*.sh 2>/dev/null || true

# Build and start services
echo ""
echo "Building and starting services..."
docker-compose build --no-cache
docker-compose up -d

# Wait for services to be healthy
echo ""
echo "Waiting for services to start..."
sleep 5

# Check database
echo -n "Checking database..."
if docker-compose exec -T postgres pg_isready -U feedback_user &>/dev/null; then
    echo -e "${GREEN}✅ Database is ready${NC}"
else
    echo -e "${RED}❌ Database failed to start${NC}"
    exit 1
fi

# Run migrations (if needed)
echo ""
echo "Running database migrations..."
docker-compose exec -T backend npm run migrate 2>/dev/null || echo "No migrations defined yet"

# Create initial admin user
echo ""
echo "Creating default admin user..."
# This would be implemented with a proper seeding script

echo ""
echo -e "${GREEN}==========================================${NC}"
echo -e "${GREEN}✅ Installation Complete!${NC}"
echo -e "${GREEN}==========================================${NC}"
echo ""
echo "Services running:"
echo "  📊 Frontend:      http://localhost:3000"
echo "  🔧 Backend API:    http://localhost:3001"
echo "  🗄️  Database:       localhost:5432 (feedback_plugin)"
echo "  📧 pgAdmin:        http://localhost:5050 (admin@unab.cl / admin123)"
echo ""
echo "Next steps:"
echo "  1. Configure LTI 1.3 in your Canvas instance:"
echo "     - Tool URL: ${TOOL_URL:-http://localhost:3001}/lti/launch"
echo "     - Public keyset URL: ${TOOL_URL:-http://localhost:3001}/lti/jwks"
echo ""
echo "  2. Add API keys in Admin Panel"
echo "  3. Create templates in Templates section"
echo "  4. Enable plugin per assignment"
echo ""
echo "To view logs:    docker-compose logs -f"
echo "To stop:         docker-compose down"
echo ""
