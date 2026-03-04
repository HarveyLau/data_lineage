from datetime import datetime, timedelta, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.api.deps.openlineage_admin_auth import require_openlineage_admin_key
from app.core.database import get_db
from app.models.openlineage_access_audit import OpenLineageAccessAudit
from app.services.openlineage_api_key_service import OpenLineageApiKeyService


router = APIRouter()


class ApiKeyCreateRequest(BaseModel):
    key_name: str = Field(..., min_length=1, max_length=120)
    expires_in_days: Optional[int] = Field(default=None, ge=1, le=3650)
    allowed_job_namespaces: Optional[List[str]] = None
    allowed_dataset_namespaces: Optional[List[str]] = None
    requests_per_minute: Optional[int] = Field(default=None, ge=1, le=1000000)
    requests_per_day: Optional[int] = Field(default=None, ge=1, le=100000000)


class ApiKeyRotateRequest(BaseModel):
    expires_in_days: Optional[int] = Field(default=None, ge=1, le=3650)
    allowed_job_namespaces: Optional[List[str]] = None
    allowed_dataset_namespaces: Optional[List[str]] = None
    requests_per_minute: Optional[int] = Field(default=None, ge=1, le=1000000)
    requests_per_day: Optional[int] = Field(default=None, ge=1, le=100000000)


def _serialize_audit(row: OpenLineageAccessAudit) -> dict:
    return {
        "id": row.id,
        "request_id": row.request_id,
        "endpoint": row.endpoint,
        "http_method": row.http_method,
        "query_params": row.query_params,
        "status_code": row.status_code,
        "allowed": row.allowed,
        "denial_reason": row.denial_reason,
        "auth_source": row.auth_source,
        "api_key_fingerprint": row.api_key_fingerprint,
        "client_ip": row.client_ip,
        "user_agent": row.user_agent,
        "created_at": row.created_at.isoformat() if row.created_at else None,
    }


def _resolve_expiry(expires_in_days: Optional[int]) -> Optional[datetime]:
    if not expires_in_days:
        return None
    return datetime.now(timezone.utc) + timedelta(days=expires_in_days)


def _serialize_key(row, policy=None) -> dict:
    return {
        "id": row.id,
        "key_name": row.key_name,
        "key_prefix": row.key_prefix,
        "is_active": row.is_active,
        "expires_at": row.expires_at.isoformat() if row.expires_at else None,
        "revoked_at": row.revoked_at.isoformat() if row.revoked_at else None,
        "last_used_at": row.last_used_at.isoformat() if row.last_used_at else None,
        "created_at": row.created_at.isoformat() if row.created_at else None,
        "policy": {
            "allowed_job_namespaces": policy.allowed_job_namespaces if policy else None,
            "allowed_dataset_namespaces": policy.allowed_dataset_namespaces if policy else None,
            "requests_per_minute": policy.requests_per_minute if policy else None,
            "requests_per_day": policy.requests_per_day if policy else None,
        },
    }


@router.post("/keys")
def create_openlineage_key(
    body: ApiKeyCreateRequest,
    _request_id: str = Depends(require_openlineage_admin_key),
    db: Session = Depends(get_db),
):
    service = OpenLineageApiKeyService(db)
    row, raw_key = service.create_key(
        key_name=body.key_name,
        expires_at=_resolve_expiry(body.expires_in_days),
        allowed_job_namespaces=body.allowed_job_namespaces,
        allowed_dataset_namespaces=body.allowed_dataset_namespaces,
        requests_per_minute=body.requests_per_minute,
        requests_per_day=body.requests_per_day,
    )
    current = service.get_key_with_policy(row.id)
    policy = current[1] if current else None
    data = _serialize_key(row, policy)
    data["api_key"] = raw_key  # only returned once
    return data


@router.get("/keys")
def list_openlineage_keys(
    include_inactive: bool = Query(True),
    _request_id: str = Depends(require_openlineage_admin_key),
    db: Session = Depends(get_db),
):
    service = OpenLineageApiKeyService(db)
    rows = service.list_keys_with_policies(include_inactive=include_inactive)
    return {"keys": [_serialize_key(row, policy) for row, policy in rows]}


@router.post("/keys/{key_id}/revoke")
def revoke_openlineage_key(
    key_id: int,
    _request_id: str = Depends(require_openlineage_admin_key),
    db: Session = Depends(get_db),
):
    service = OpenLineageApiKeyService(db)
    row = service.revoke_key(key_id)
    if not row:
        raise HTTPException(status_code=404, detail=f"OpenLineage API key not found: id={key_id}")
    current = service.get_key_with_policy(row.id)
    policy = current[1] if current else None
    return _serialize_key(row, policy)


@router.post("/keys/{key_id}/rotate")
def rotate_openlineage_key(
    key_id: int,
    body: ApiKeyRotateRequest,
    _request_id: str = Depends(require_openlineage_admin_key),
    db: Session = Depends(get_db),
):
    service = OpenLineageApiKeyService(db)
    result = service.rotate_key(
        key_id=key_id,
        expires_at=_resolve_expiry(body.expires_in_days),
        allowed_job_namespaces=body.allowed_job_namespaces,
        allowed_dataset_namespaces=body.allowed_dataset_namespaces,
        requests_per_minute=body.requests_per_minute,
        requests_per_day=body.requests_per_day,
    )
    if not result:
        raise HTTPException(status_code=404, detail=f"OpenLineage API key not found: id={key_id}")
    old_row, new_row, raw_key = result
    old_current = service.get_key_with_policy(old_row.id)
    old_policy = old_current[1] if old_current else None
    new_current = service.get_key_with_policy(new_row.id)
    new_policy = new_current[1] if new_current else None
    return {
        "revoked_key": _serialize_key(old_row, old_policy),
        "new_key": {
            **_serialize_key(new_row, new_policy),
            "api_key": raw_key,  # only returned once
        },
    }


@router.get("/access-audits")
def list_openlineage_access_audits(
    limit: int = Query(200, ge=1, le=1000),
    offset: int = Query(0, ge=0),
    status_code: Optional[int] = None,
    allowed: Optional[bool] = None,
    endpoint: Optional[str] = None,
    _request_id: str = Depends(require_openlineage_admin_key),
    db: Session = Depends(get_db),
):
    query = db.query(OpenLineageAccessAudit)
    if status_code is not None:
        query = query.filter(OpenLineageAccessAudit.status_code == status_code)
    if allowed is not None:
        query = query.filter(OpenLineageAccessAudit.allowed == allowed)
    if endpoint:
        query = query.filter(OpenLineageAccessAudit.endpoint.ilike(f"%{endpoint}%"))

    total = query.order_by(None).count()
    rows = (
        query.order_by(OpenLineageAccessAudit.id.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )
    return {
        "total": total,
        "limit": limit,
        "offset": offset,
        "audits": [_serialize_audit(row) for row in rows],
    }
