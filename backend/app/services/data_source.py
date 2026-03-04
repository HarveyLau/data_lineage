from abc import ABC, abstractmethod
from typing import Dict, Any, List, Optional
from app.services.credential_service import CredentialService

class DataSource(ABC):
    """Abstract base class for all data sources"""
    
    def __init__(self, credential_service: CredentialService, credential_type: str, host: str, username: str):
        self.credential_service = credential_service
        self.credential_type = credential_type
        self.host = host
        self.username = username
        self._connected = False
    
    @abstractmethod
    def connect(self) -> bool:
        """Establish connection to the data source"""
        pass
    
    @abstractmethod
    def disconnect(self):
        """Close connection to the data source"""
        pass
    
    @abstractmethod
    def read_file(self, path: str) -> str:
        """Read a file from the data source"""
        pass
    
    @abstractmethod
    def query_table(self, table_name: str, schema: Optional[str] = None, limit: int = 100) -> List[Dict[str, Any]]:
        """Query a table from the data source"""
        pass
    
    @abstractmethod
    def list_files(self, directory: str) -> List[str]:
        """List files in a directory"""
        pass
    
    @property
    def is_connected(self) -> bool:
        return self._connected
