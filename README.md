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
- `OPENLINEAGE_REQUIRE_API_KEY`: enable/disable API key auth for read APIs
- `OPENLINEAGE_API_KEYS`: comma-separated API keys for `/api/v1/openlineage/*`
- `OPENLINEAGE_ADMIN_KEY`: admin key for managing OpenLineage API keys

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
- Each import now persists OpenLineage event history locally in app DB
  (`START` + `COMPLETE/FAIL`) so lineage events remain queryable even if external systems are unavailable.
- Marquez UI is embedded in the frontend (second tab).

## OpenLineage Read APIs (for external systems)

The backend exposes OpenLineage-structured data for downstream systems:

- `GET /api/v1/openlineage/events`
  - Query by `run_id`, `job_namespace`, `job_name`, `event_type`,
    `dataset_namespace`, `dataset_name`, `since`, `until`, `limit`, `offset`
- `GET /api/v1/openlineage/runs/{run_id}`
- `GET /api/v1/openlineage/jobs/{job_namespace}/{job_name}`
- `GET /api/v1/openlineage/jobs/events?job_namespace=...&job_name=...`
- `GET /api/v1/openlineage/datasets/{dataset_namespace}/{dataset_name}/events`
- `GET /api/v1/openlineage/datasets/events?dataset_namespace=...&dataset_name=...`

All responses include standard OpenLineage payloads in `payload`.

Authentication:
- Include `X-API-Key: <key>` (or `Authorization: Bearer <key>`) for all `/api/v1/openlineage/*` APIs.
- Default local key in Docker Compose: `dev-openlineage-read-key`.

Audit:
- Every OpenLineage read request (allowed or denied) is recorded in `openlineage_access_audits`.

## OpenLineage API Key Management

Admin endpoints (protected by `X-Admin-Key` or `Authorization: Bearer <admin-key>`):

- `POST /api/v1/openlineage/admin/keys`
  - Create managed API key (stored hashed in DB, plaintext returned once)
  - Optional policy fields:
    - `allowed_job_namespaces` (list)
    - `allowed_dataset_namespaces` (list)
    - `requests_per_minute` (int)
    - `requests_per_day` (int)
- `GET /api/v1/openlineage/admin/keys`
  - List API key metadata (no plaintext)
- `POST /api/v1/openlineage/admin/keys/{key_id}/revoke`
  - Revoke key
- `POST /api/v1/openlineage/admin/keys/{key_id}/rotate`
  - Revoke old key and issue new key (can override policy)

Default local admin key in Docker Compose: `dev-openlineage-admin-key`.

Scoped keys:
- If a key has namespace scopes, access is restricted to those scopes.
- For `/api/v1/openlineage/events`, scoped keys must include namespace filters in query.

Rate limiting and quota:
- If configured on key policy, requests exceeding `requests_per_minute` or `requests_per_day` receive `429`.

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

