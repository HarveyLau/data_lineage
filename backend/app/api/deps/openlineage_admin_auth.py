import uuid
from typing import Optional

from fastapi import Header, HTTPException

from app.core.config import settings


def _extract_admin_key(x_admin_key: Optional[str], authorization: Optional[str]) -> Optional[str]:
    if x_admin_key and x_admin_key.strip():
        return x_admin_key.strip()

    if authorization and authorization.lower().startswith("bearer "):
        return authorization[7:].strip()

    return None


def require_openlineage_admin_key(
    x_admin_key: Optional[str] = Header(default=None, alias="X-Admin-Key"),
    authorization: Optional[str] = Header(default=None, alias="Authorization"),
    x_request_id: Optional[str] = Header(default=None, alias="X-Request-Id"),
) -> str:
    request_id = x_request_id.strip() if x_request_id and x_request_id.strip() else str(uuid.uuid4())
    configured = settings.OPENLINEAGE_ADMIN_KEY
    if not configured:
        raise HTTPException(status_code=503, detail=f"[{request_id}] OpenLineage admin key is not configured")

    provided = _extract_admin_key(x_admin_key, authorization)
    if not provided:
        raise HTTPException(status_code=401, detail=f"[{request_id}] Missing admin key")
    if provided != configured:
        raise HTTPException(status_code=403, detail=f"[{request_id}] Invalid admin key")
    return request_id
