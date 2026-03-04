from sqlalchemy import Column, Integer, String, Text, DateTime, JSON, UniqueConstraint
from sqlalchemy.sql import func
from app.core.database import Base

class Credential(Base):
    __tablename__ = "credentials"

    id = Column(Integer, primary_key=True, index=True)
    credential_type = Column(String, nullable=False, default="SSH")  # SSH, POSTGRES, ORACLE, MYSQL, etc.
    host = Column(String, nullable=False)
    username = Column(String, nullable=False)
    encrypted_password = Column(Text, nullable=False)
    connection_params = Column(JSON, nullable=True)  # Store port, database, schema, etc.
    description = Column(String, nullable=True)
    key_id = Column(String, nullable=True) # For key rotation support
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), server_default=func.now())

    __table_args__ = (
        UniqueConstraint('credential_type', 'host', 'username', name='uix_type_host_username'),
    )
