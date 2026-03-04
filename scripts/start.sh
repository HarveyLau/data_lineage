#!/bin/bash
set -e

echo "Starting AI Data Lineage Services..."

cd docker
docker-compose up -d

echo "Services started!"
echo "------------------------------------------------"
echo "Frontend:   http://localhost:3000"
echo "Backend:    http://localhost:8000"
echo "Gravitino:  http://localhost:8090"
echo "------------------------------------------------"
echo "To stop services, run: cd docker && docker-compose down"

