from sqlalchemy import Column, DateTime, ForeignKey, Integer, JSON
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship

from app.core.database import Base


class OpenLineageApiKeyPolicy(Base):
    __tablename__ = "openlineage_api_key_policies"

    id = Column(Integer, primary_key=True, index=True)
    api_key_id = Column(
        Integer,
        ForeignKey("openlineage_api_keys.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    )
    allowed_job_namespaces = Column(JSON, nullable=True)
    allowed_dataset_namespaces = Column(JSON, nullable=True)
    requests_per_minute = Column(Integer, nullable=True)
    requests_per_day = Column(Integer, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), server_default=func.now(), nullable=False)

    api_key = relationship("OpenLineageApiKey", back_populates="policy")
