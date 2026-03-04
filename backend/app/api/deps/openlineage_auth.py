from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
import hashlib
import uuid
from typing import List, Optional

from fastapi import Depends, Header, HTTPException, Request
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.services.openlineage_access_audit_service import OpenLineageAccessAuditService
from app.services.openlineage_api_key_service import OpenLineageApiKeyService


@dataclass
class OpenLineageAuthContext:
    request_id: str
    auth_source: str
    api_key_fingerprint: Optional[str]
    key_id: Optional[int] = None
    key_name: Optional[str] = None
    allowed_job_namespaces: Optional[List[str]] = None
    allowed_dataset_namespaces: Optional[List[str]] = None
    requests_per_minute: Optional[int] = None
    requests_per_day: Optional[int] = None


@dataclass
class OpenLineageRequestContext:
    db: Session
    auth: OpenLineageAuthContext


def _configured_api_keys() -> List[str]:
    raw = settings.OPENLINEAGE_API_KEYS or ""
    return [item.strip() for item in raw.split(",") if item.strip()]


def _extract_api_key(
    x_api_key: Optional[str],
    authorization: Optional[str],
) -> tuple[Optional[str], str]:
    if x_api_key and x_api_key.strip():
        return x_api_key.strip(), "x-api-key"

    if authorization and authorization.lower().startswith("bearer "):
        return authorization[7:].strip(), "authorization"

    return None, "none"


def _fingerprint(api_key: Optional[str]) -> Optional[str]:
    if not api_key:
        return None
    digest = hashlib.sha256(api_key.encode("utf-8")).hexdigest()
    return digest[:12]


def _audit_attempt(
    db: Session,
    request: Request,
    request_id: str,
    status_code: int,
    allowed: bool,
    auth_source: str,
    api_key_fingerprint: Optional[str],
    denial_reason: Optional[str] = None,
) -> None:
    try:
        OpenLineageAccessAuditService(db).record(
            request_id=request_id,
            endpoint=request.url.path,
            http_method=request.method,
            query_params=dict(request.query_params),
            status_code=status_code,
            allowed=allowed,
            denial_reason=denial_reason,
            auth_source=auth_source,
            api_key_fingerprint=api_key_fingerprint,
            client_ip=request.client.host if request.client else None,
            user_agent=request.headers.get("user-agent"),
        )
    except Exception as e:
        # Audit errors should not block request processing.
        print(f"[{request_id}] Failed to write openlineage access audit: {e}")


def _enforce_db_key_limits(
    *,
    db: Session,
    request: Request,
    request_id: str,
    key_fingerprint: str,
    auth_source: str,
    requests_per_minute: Optional[int],
    requests_per_day: Optional[int],
) -> None:
    audit_service = OpenLineageAccessAuditService(db)
    now = datetime.now(timezone.utc)

    if requests_per_minute is not None:
        minute_window_start = now - timedelta(minutes=1)
        count = audit_service.count_allowed_since(
            api_key_fingerprint=key_fingerprint,
            since=minute_window_start,
        )
        if count >= requests_per_minute:
            _audit_attempt(
                db=db,
                request=request,
                request_id=request_id,
                status_code=429,
                allowed=False,
                auth_source=auth_source,
                api_key_fingerprint=key_fingerprint,
                denial_reason="rate limit per minute exceeded",
            )
            raise HTTPException(status_code=429, detail="API key minute rate limit exceeded")

    if requests_per_day is not None:
        day_window_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        count = audit_service.count_allowed_since(
            api_key_fingerprint=key_fingerprint,
            since=day_window_start,
        )
        if count >= requests_per_day:
            _audit_attempt(
                db=db,
                request=request,
                request_id=request_id,
                status_code=429,
                allowed=False,
                auth_source=auth_source,
                api_key_fingerprint=key_fingerprint,
                denial_reason="daily quota exceeded",
            )
            raise HTTPException(status_code=429, detail="API key daily quota exceeded")


def require_openlineage_api_key(
    request: Request,
    db: Session = Depends(get_db),
    x_request_id: Optional[str] = Header(default=None, alias="X-Request-Id"),
    x_api_key: Optional[str] = Header(default=None, alias="X-API-Key"),
    authorization: Optional[str] = Header(default=None, alias="Authorization"),
) -> OpenLineageRequestContext:
    request_id = x_request_id.strip() if x_request_id and x_request_id.strip() else str(uuid.uuid4())
    provided_key, auth_source = _extract_api_key(x_api_key, authorization)
    fingerprint = _fingerprint(provided_key)

    key_service = OpenLineageApiKeyService(db)
    configured_keys = _configured_api_keys()
    has_db_keys = key_service.has_active_db_keys()
    require_key = settings.OPENLINEAGE_REQUIRE_API_KEY or bool(configured_keys) or has_db_keys

    if require_key and not configured_keys and not has_db_keys:
        _audit_attempt(
            db=db,
            request=request,
            request_id=request_id,
            status_code=503,
            allowed=False,
            auth_source=auth_source,
            api_key_fingerprint=fingerprint,
            denial_reason="openlineage api key misconfigured",
        )
        raise HTTPException(status_code=503, detail="OpenLineage API key auth is enabled but no key is configured")

    if require_key and not provided_key:
        _audit_attempt(
            db=db,
            request=request,
            request_id=request_id,
            status_code=401,
            allowed=False,
            auth_source=auth_source,
            api_key_fingerprint=fingerprint,
            denial_reason="missing api key",
        )
        raise HTTPException(status_code=401, detail="Missing API key")

    if require_key and provided_key not in configured_keys:
        db_key = key_service.validate_db_key(provided_key)
        if db_key:
            _enforce_db_key_limits(
                db=db,
                request=request,
                request_id=request_id,
                key_fingerprint=db_key.fingerprint,
                auth_source="db-key",
                requests_per_minute=db_key.requests_per_minute,
                requests_per_day=db_key.requests_per_day,
            )
            return OpenLineageRequestContext(
                db=db,
                auth=OpenLineageAuthContext(
                    request_id=request_id,
                    auth_source="db-key",
                    api_key_fingerprint=db_key.fingerprint,
                    key_id=db_key.key.id,
                    key_name=db_key.key.key_name,
                    allowed_job_namespaces=db_key.allowed_job_namespaces,
                    allowed_dataset_namespaces=db_key.allowed_dataset_namespaces,
                    requests_per_minute=db_key.requests_per_minute,
                    requests_per_day=db_key.requests_per_day,
                ),
            )

        _audit_attempt(
            db=db,
            request=request,
            request_id=request_id,
            status_code=403,
            allowed=False,
            auth_source=auth_source,
            api_key_fingerprint=fingerprint,
            denial_reason="invalid api key",
        )
        raise HTTPException(status_code=403, detail="Invalid API key")

    return OpenLineageRequestContext(
        db=db,
        auth=OpenLineageAuthContext(
            request_id=request_id,
            auth_source=auth_source,
            api_key_fingerprint=fingerprint,
        ),
    )
