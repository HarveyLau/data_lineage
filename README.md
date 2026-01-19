# AI+MCP Data Lineage

An AI-powered data lineage system that parses Control-M XML and scripts, retrieves remote resources via SSH/DB credentials, converts lineage into OpenLineage, registers datasets into Gravitino, and visualizes everything in a React UI (with Marquez embedded).

## What This Project Does

1. **User uploads** Control-M XML or scripts (SAS/Python/Shell).
2. **Parser extracts** jobs, file paths, and database connections.
3. **Credential prompts** are shown for missing SSH/DB access.
4. **Remote access** is performed via MCP-style SSH and DB connectors.
5. **Lineage is analyzed** by Google Gemini and normalized to OpenLineage JSON.
6. **Metadata is registered** to Gravitino and events are sent to Marquez.
7. **Frontend** shows a graph, table, and Marquez UI.

## Architecture

- **Backend**: FastAPI + SQLAlchemy + Pydantic
- **Frontend**: React + TypeScript + Material UI + Cytoscape
- **Metadata Store**: Gravitino (PostgreSQL backend)
- **Lineage Standard**: OpenLineage JSON
- **Marquez**: OpenLineage reference UI + API
- **AI**: Google Gemini (via `google-genai`)
- **MCP**: SSH-based remote access
- **Databases**: PostgreSQL (app DB + Gravitino DB + seed-db)

## Repository Structure

```
backend/       FastAPI service, parsers, data sources, Gravitino/Marquez clients
frontend/      React app (graph, table, credentials UX)
docker/        Docker Compose and service Dockerfiles
scripts/       Setup and start helpers
docs/          Project guides
```

## Services in Docker Compose

- **backend**: FastAPI API server
- **frontend**: React UI
- **postgres**: App DB (credentials, state)
- **gravitino**: Metadata lake
- **marquez-db / marquez-api / marquez-web**: OpenLineage UI stack
- **sas-system**: Simulated SSH VM with files
- **seed-db**: Simulated PostgreSQL data source

## Prerequisites

- Docker Desktop
- Node.js (optional for local dev)
- Python 3.10+ (optional for local dev)

## Quick Start

From the project root:

```bash
cd docker
docker-compose up -d --build
```

Frontend: http://localhost:3000  
Backend: http://localhost:8000/api/v1  
Gravitino: http://localhost:8090  
Marquez UI: http://localhost:3001

## Configuration

Key environment variables are in `docker/docker-compose.yml`.

- `DATABASE_URL`: app DB (credentials storage)
- `GRAVITINO_URL`: Gravitino API base
- `MARQUEZ_URL`: Marquez API base
- `GEMINI_API_KEY`: Google Gemini API key

## Usage

1. Open the UI at http://localhost:3000
2. Upload `example_scripts/etl_process_controlm.xml`
3. When prompted, enter missing credentials:
   - **SSH**: host `sas-system`, username `sasuser`, port `22`
   - **POSTGRES**: host `seed-db`, username `seeduser`, port `5432`, database `seed_db`
4. View:
   - Lineage graph
   - Lineage table (sources/targets)
   - Marquez UI tab

## Credentials Management

- Stored in the app database (encrypted).
- Managed in the **Settings** dialog in the UI.
- When missing credentials are detected, inline forms appear for each required credential.

No change is needed to Gravitino or the app DB credentials unless you modify the Docker Compose configuration.

## Gravitino Registration

- Datasets are registered under `metalake: lineage_lake` and `catalog: data_catalog`.
- File resources (e.g., SSH files) are registered under schema names derived from host (e.g., `sas_system`).

## OpenLineage + Marquez

- Backend converts AI lineage into OpenLineage events.
- Events are sent to Marquez at `/api/v1/lineage`.
- Marquez UI is embedded in the frontend (second tab).

## Simulated VMs

### sas-system (SSH)
- Container provides `/var/data/incoming/transactions_20240101.csv`
- Output file path: `/var/reports/high_value_sales_report.xlsx`

### seed-db (PostgreSQL)
- Database: `seed_db`
- Table: `public.customers` (sample data)

## Control-M XML Parsing Notes

Parser looks for:
- `<NODEID>` or `NODEID` attribute
- `VARIABLE` nodes:
  - `INPUT_FILE`, `OUTPUT_FILE`
  - `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_SCHEMA`, `DB_TABLE`

## Troubleshooting

### Gravitino errors
- Ensure `postgres` and `gravitino` containers are healthy.
- Check `docker-compose logs gravitino`.

### Missing credentials not prompted
- Verify Control-M XML includes `NODEID` and `VARIABLE` nodes.
- Check backend logs and missing credentials response in `/api/v1/lineage/upload`.

### Frontend build errors
- Restart frontend: `docker-compose restart frontend`
- Ensure `frontend/src/services/api.ts` exports are up to date.

## Development

Backend (local):
```bash
cd backend
uvicorn app.main:app --reload
```

Frontend (local):
```bash
cd frontend
npm install
npm start
```

## Security Notes

- Credentials are encrypted at rest.
- Do not commit real secrets to version control.
- Replace the `ENCRYPTION_KEY` in production.

## Documentation

- `docs/MULTI_DATASOURCE_GUIDE.md`
- `scripts/README.md`

