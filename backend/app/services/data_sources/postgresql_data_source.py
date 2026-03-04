import psycopg2
from psycopg2.extras import RealDictCursor
from app.services.data_source import DataSource
from app.services.credential_service import CredentialService
from typing import Dict, Any, List, Optional

class PostgreSQLDataSource(DataSource):
    """PostgreSQL database data source"""
    
    def __init__(
        self, 
        credential_service: CredentialService, 
        host: str, 
        username: str,
        database: str,
        port: int = 5432
    ):
        super().__init__(credential_service, "POSTGRES", host, username)
        self.database = database
        self.port = port
        self.connection = None
    
    def connect(self) -> bool:
        try:
            password = self.credential_service.get_password(self.credential_type, self.host, self.username)
            if not password:
                return False
            
            self.connection = psycopg2.connect(
                host=self.host,
                port=self.port,
                database=self.database,
                user=self.username,
                password=password
            )
            self._connected = True
            return True
        except Exception as e:
            print(f"PostgreSQL connection failed: {e}")
            self._connected = False
            return False
    
    def disconnect(self):
        if self.connection:
            self.connection.close()
            self.connection = None
        self._connected = False
    
    def read_file(self, path: str) -> str:
        raise NotImplementedError("PostgreSQL data source does not support file reading via this interface")
    
    def query_table(self, table_name: str, schema: Optional[str] = None, limit: int = 100) -> List[Dict[str, Any]]:
        if not self._connected:
            if not self.connect():
                raise Exception("Failed to connect to PostgreSQL")
        
        full_table_name = f"{schema}.{table_name}" if schema else table_name
        query = f"SELECT * FROM {full_table_name} LIMIT {limit}"
        
        with self.connection.cursor(cursor_factory=RealDictCursor) as cursor:
            cursor.execute(query)
            rows = cursor.fetchall()
            return [dict(row) for row in rows]
    
    def list_files(self, directory: str) -> List[str]:
        raise NotImplementedError("PostgreSQL data source does not support file listing")
