from sqlalchemy import Boolean, Column, DateTime, Integer, String
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship

from app.core.database import Base


class OpenLineageApiKey(Base):
    __tablename__ = "openlineage_api_keys"

    id = Column(Integer, primary_key=True, index=True)
    key_name = Column(String(120), nullable=False, index=True)
    key_hash = Column(String(128), nullable=False, unique=True, index=True)
    key_prefix = Column(String(16), nullable=False, index=True)
    is_active = Column(Boolean, nullable=False, default=True, index=True)
    expires_at = Column(DateTime(timezone=True), nullable=True, index=True)
    revoked_at = Column(DateTime(timezone=True), nullable=True, index=True)
    last_used_at = Column(DateTime(timezone=True), nullable=True, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False, index=True)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), server_default=func.now(), nullable=False)

    policy = relationship(
        "OpenLineageApiKeyPolicy",
        back_populates="api_key",
        uselist=False,
        cascade="all, delete-orphan",
    )
