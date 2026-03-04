import paramiko
from app.services.credential_service import CredentialService
from typing import Optional, List, Dict

class CredentialMissingError(Exception):
    def __init__(self, host: str, username: Optional[str] = None):
        self.host = host
        self.username = username
        self.message = f"Credentials missing for {host}"
        super().__init__(self.message)

class McpService:
    def __init__(self, credential_service: CredentialService):
        self.credential_service = credential_service
        self.clients: Dict[str, paramiko.SSHClient] = {}

    def _get_ssh_client(self, host: str, username: str, port: int = 22) -> paramiko.SSHClient:
        key = f"{username}@{host}:{port}"
        if key in self.clients:
            return self.clients[key]
        
        password = self.credential_service.get_password("SSH", host, username)
        if not password:
            raise CredentialMissingError(host, username)

        client = paramiko.SSHClient()
        client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        try:
            client.connect(host, port=port, username=username, password=password, timeout=10)
            self.clients[key] = client
            return client
        except paramiko.AuthenticationException:
            raise CredentialMissingError(host, username)
        except Exception as e:
            raise e

    def execute_command(self, host: str, username: str, command: str, port: int = 22) -> str:
        client = self._get_ssh_client(host, username, port)
        stdin, stdout, stderr = client.exec_command(command)
        exit_status = stdout.channel.recv_exit_status()
        if exit_status != 0:
            error_msg = stderr.read().decode().strip()
            raise Exception(f"Command failed with status {exit_status}: {error_msg}")
        return stdout.read().decode().strip()

    def read_file(self, host: str, username: str, path: str, port: int = 22) -> str:
        return self.execute_command(host, username, f"cat {path}", port)

    def find_script(self, host: str, username: str, script_name: str, search_path: str = ".", port: int = 22) -> List[str]:
        cmd = f"find {search_path} -name '{script_name}' 2>/dev/null"
        result = self.execute_command(host, username, cmd, port)
        return [line for line in result.split('\n') if line]

    def check_connection(self, host: str, username: str, port: int = 22) -> bool:
        try:
            self._get_ssh_client(host, username, port)
            return True
        except:
            return False
