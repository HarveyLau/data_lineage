#!/bin/bash
set -e

echo "Setting up AI Data Lineage Project..."

# 1. Clone Gravitino (as requested to download from official repo)
if [ ! -d "gravitino-repo" ]; then
    echo "Cloning Gravitino repository..."
    git clone https://github.com/apache/gravitino.git gravitino-repo
    echo "Gravitino repository cloned."
else
    echo "Gravitino repository already exists."
fi

# 2. Setup Environment
if [ ! -f ".env" ]; then
    echo "Creating .env file..."
    cat > .env <<EOF
PROJECT_NAME="AI Data Lineage"
POSTGRES_USER=user
POSTGRES_PASSWORD=password
GRAVITINO_VERSION=1.1.0
OLLAMA_HOST=http://host.docker.internal:11434
EOF
    echo ".env created."
fi

# 3. Build Docker Images
echo "Building project images..."
cd docker
docker-compose build

echo "Setup complete. Run ./scripts/start.sh to start the services."

