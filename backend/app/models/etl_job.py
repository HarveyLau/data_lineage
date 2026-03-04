from sqlalchemy import Column, Integer, String, DateTime
from sqlalchemy.sql import func
from app.core.database import Base


class EtlJob(Base):
    __tablename__ = "etl_jobs"

    id = Column(Integer, primary_key=True, index=True)
    job_name = Column(String, nullable=False, unique=True, index=True)
    source_type = Column(String, nullable=False, default="unknown")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
