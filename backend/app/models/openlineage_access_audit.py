from sqlalchemy import Column, Integer, String, DateTime, JSON, Boolean
from sqlalchemy.sql import func

from app.core.database import Base


class OpenLineageAccessAudit(Base):
    __tablename__ = "openlineage_access_audits"

    id = Column(Integer, primary_key=True, index=True)
    request_id = Column(String, nullable=False, index=True)
    endpoint = Column(String, nullable=False, index=True)
    http_method = Column(String, nullable=False)
    query_params = Column(JSON, nullable=True)
    status_code = Column(Integer, nullable=False, index=True)
    allowed = Column(Boolean, nullable=False, default=False)
    denial_reason = Column(String, nullable=True)
    auth_source = Column(String, nullable=True)  # x-api-key / authorization / none
    api_key_fingerprint = Column(String, nullable=True, index=True)
    client_ip = Column(String, nullable=True)
    user_agent = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False, index=True)
