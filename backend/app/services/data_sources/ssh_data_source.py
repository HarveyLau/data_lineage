import paramiko
from app.services.data_source import DataSource
from app.services.credential_service import CredentialService
from typing import Dict, Any, List, Optional
from app.services.mcp_service import CredentialMissingError

class SSHDataSource(DataSource):
    """SSH-based data source for file access on remote systems"""
    
    def __init__(self, credential_service: CredentialService, host: str, username: str, port: int = 22):
        super().__init__(credential_service, "SSH", host, username)
        self.port = port
        self.client: Optional[paramiko.SSHClient] = None
    
    def connect(self) -> bool:
        try:
            password = self.credential_service.get_password(self.credential_type, self.host, self.username)
            if not password:
                raise CredentialMissingError(self.host, self.username)
            
            self.client = paramiko.SSHClient()
            self.client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
            self.client.connect(self.host, port=self.port, username=self.username, password=password, timeout=10)
            self._connected = True
            return True
        except Exception as e:
            print(f"SSH connection failed: {e}")
            self._connected = False
            return False
    
    def disconnect(self):
        if self.client:
            self.client.close()
            self.client = None
        self._connected = False
    
    def read_file(self, path: str) -> str:
        if not self._connected:
            self.connect()
        
        stdin, stdout, stderr = self.client.exec_command(f"cat {path}")
        exit_status = stdout.channel.recv_exit_status()
        if exit_status != 0:
            error_msg = stderr.read().decode().strip()
            raise Exception(f"Failed to read file {path}: {error_msg}")
        return stdout.read().decode()
    
    def query_table(self, table_name: str, schema: Optional[str] = None, limit: int = 100) -> List[Dict[str, Any]]:
        raise NotImplementedError("SSH data source does not support table queries")
    
    def list_files(self, directory: str) -> List[str]:
        if not self._connected:
            self.connect()
        
        stdin, stdout, stderr = self.client.exec_command(f"ls -1 {directory} 2>/dev/null")
        exit_status = stdout.channel.recv_exit_status()
        if exit_status != 0:
            return []
        return [line.strip() for line in stdout.read().decode().strip().split('\n') if line.strip()]
