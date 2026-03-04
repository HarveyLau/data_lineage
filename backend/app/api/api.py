from fastapi import APIRouter
from app.api.routes import lineage, credentials, etl, openlineage, openlineage_admin

api_router = APIRouter()

api_router.include_router(lineage.router, prefix="/lineage", tags=["lineage"])
api_router.include_router(credentials.router, prefix="/credentials", tags=["credentials"])
api_router.include_router(etl.router, prefix="/etl", tags=["etl"])
api_router.include_router(openlineage.router, prefix="/openlineage", tags=["openlineage"])
api_router.include_router(openlineage_admin.router, prefix="/openlineage/admin", tags=["openlineage-admin"])