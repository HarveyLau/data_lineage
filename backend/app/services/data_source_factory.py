from typing import Optional
from app.services.credential_service import CredentialService
from app.services.data_source import DataSource
from app.services.data_sources.ssh_data_source import SSHDataSource
from app.services.data_sources.postgresql_data_source import PostgreSQLDataSource
from app.models.credential import Credential

class DataSourceFactory:
    """Factory for creating data source instances based on type"""
    
    @staticmethod
    def create(
        credential_service: CredentialService,
        credential_type: str,
        host: str,
        username: str,
        connection_params: Optional[dict] = None
    ) -> Optional[DataSource]:
        """
        Create a data source instance based on type
        
        Args:
            credential_service: Service for retrieving credentials
            credential_type: Type of data source (SSH, POSTGRES, ORACLE, etc.)
            host: Host address
            username: Username for authentication
            connection_params: Additional connection parameters (port, database, etc.)
        """
        connection_params = connection_params or {}
        
        if credential_type.upper() == "SSH":
            port = connection_params.get("port", 22)
            return SSHDataSource(credential_service, host, username, port)
        
        elif credential_type.upper() == "POSTGRES" or credential_type.upper() == "POSTGRESQL":
            database = connection_params.get("database", "postgres")
            port = connection_params.get("port", 5432)
            return PostgreSQLDataSource(credential_service, host, username, database, port)
        
        # Future: Add more data source types
        # elif credential_type.upper() == "ORACLE":
        #     ...
        # elif credential_type.upper() == "MYSQL":
        #     ...
        
        else:
            raise ValueError(f"Unsupported data source type: {credential_type}")
    
    @staticmethod
    def create_from_credential(credential_service: CredentialService, credential: Credential) -> Optional[DataSource]:
        """Create data source from a Credential model instance"""
        return DataSourceFactory.create(
            credential_service,
            credential.credential_type,
            credential.host,
            credential.username,
            credential.connection_params or {}
        )
