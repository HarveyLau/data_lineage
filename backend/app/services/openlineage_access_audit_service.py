from datetime import datetime
from typing import Any, Dict, Optional

from sqlalchemy.orm import Session

from app.models.openlineage_access_audit import OpenLineageAccessAudit


class OpenLineageAccessAuditService:
    def __init__(self, db: Session):
        self.db = db

    def record(
        self,
        *,
        request_id: str,
        endpoint: str,
        http_method: str,
        query_params: Optional[Dict[str, Any]],
        status_code: int,
        allowed: bool,
        denial_reason: Optional[str] = None,
        auth_source: Optional[str] = None,
        api_key_fingerprint: Optional[str] = None,
        client_ip: Optional[str] = None,
        user_agent: Optional[str] = None,
    ) -> None:
        row = OpenLineageAccessAudit(
            request_id=request_id,
            endpoint=endpoint,
            http_method=http_method,
            query_params=query_params or {},
            status_code=status_code,
            allowed=allowed,
            denial_reason=denial_reason,
            auth_source=auth_source,
            api_key_fingerprint=api_key_fingerprint,
            client_ip=client_ip,
            user_agent=user_agent,
        )
        self.db.add(row)
        self.db.commit()

    def count_allowed_since(self, *, api_key_fingerprint: str, since: datetime) -> int:
        return (
            self.db.query(OpenLineageAccessAudit)
            .filter(OpenLineageAccessAudit.api_key_fingerprint == api_key_fingerprint)
            .filter(OpenLineageAccessAudit.allowed.is_(True))
            .filter(OpenLineageAccessAudit.created_at >= since)
            .count()
        )
