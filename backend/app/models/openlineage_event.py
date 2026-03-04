from sqlalchemy import Column, Integer, String, DateTime, JSON, ForeignKey, Index
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.core.database import Base


class OpenLineageEvent(Base):
    __tablename__ = "openlineage_events"

    id = Column(Integer, primary_key=True, index=True)
    request_id = Column(String, nullable=True, index=True)
    run_id = Column(String, nullable=False, index=True)
    job_namespace = Column(String, nullable=False, index=True)
    job_name = Column(String, nullable=False, index=True)
    event_type = Column(String, nullable=False, index=True)  # START/COMPLETE/FAIL
    event_time = Column(DateTime(timezone=True), nullable=False, index=True)
    event_payload = Column(JSON, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    datasets = relationship(
        "OpenLineageDatasetRef",
        back_populates="event",
        cascade="all, delete-orphan",
    )

    __table_args__ = (
        Index("idx_openlineage_job_lookup", "job_namespace", "job_name", "event_time"),
    )


class OpenLineageDatasetRef(Base):
    __tablename__ = "openlineage_dataset_refs"

    id = Column(Integer, primary_key=True, index=True)
    event_id = Column(Integer, ForeignKey("openlineage_events.id", ondelete="CASCADE"), nullable=False, index=True)
    role = Column(String, nullable=False, index=True)  # INPUT/OUTPUT
    dataset_namespace = Column(String, nullable=False, index=True)
    dataset_name = Column(String, nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    event = relationship("OpenLineageEvent", back_populates="datasets")

    __table_args__ = (
        Index(
            "idx_openlineage_dataset_lookup",
            "dataset_namespace",
            "dataset_name",
            "role",
        ),
    )
