from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, JSON
from sqlalchemy.sql import func
from app.core.database import Base


class EtlRun(Base):
    __tablename__ = "etl_runs"

    id = Column(Integer, primary_key=True, index=True)
    job_id = Column(Integer, ForeignKey("etl_jobs.id"), nullable=False, index=True)
    request_id = Column(String, nullable=False, index=True)
    openlineage_run_id = Column(String, nullable=False, index=True)
    uploaded_filename = Column(String, nullable=False)
    content_hash = Column(String, nullable=False)
    status = Column(String, nullable=False, default="STARTED")  # STARTED/COMPLETED/FAILED
    error = Column(String, nullable=True)
    started_at = Column(DateTime(timezone=True), server_default=func.now())
    ended_at = Column(DateTime(timezone=True), nullable=True)
    missing_credentials_count = Column(Integer, nullable=False, default=0)
    parsed_summary = Column(JSON, nullable=True)
    lineage_summary = Column(JSON, nullable=True)
