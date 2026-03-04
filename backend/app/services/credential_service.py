from sqlalchemy.orm import Session
from app.models.credential import Credential
from app.utils.crypto import encrypt, decrypt
from typing import Optional, List, Dict, Any

class CredentialService:
    def __init__(self, db: Session):
        self.db = db

    def create_or_update_credential(
        self, 
        credential_type: str,
        host: str, 
        username: str, 
        password: str,
        connection_params: Optional[Dict[str, Any]] = None,
        description: Optional[str] = None
    ) -> Credential:
        encrypted = encrypt(password)
        cred = self.get_credential(credential_type, host, username)
        if cred:
            cred.encrypted_password = encrypted
            if connection_params:
                cred.connection_params = connection_params
            if description:
                cred.description = description
        else:
            cred = Credential(
                credential_type=credential_type,
                host=host, 
                username=username, 
                encrypted_password=encrypted,
                connection_params=connection_params or {},
                description=description
            )
            self.db.add(cred)
        
        self.db.commit()
        self.db.refresh(cred)
        return cred

    def get_credential(self, credential_type: str, host: str, username: str) -> Optional[Credential]:
        return self.db.query(Credential).filter(
            Credential.credential_type == credential_type,
            Credential.host == host, 
            Credential.username == username
        ).first()

    def get_password(self, credential_type: str, host: str, username: str) -> Optional[str]:
        cred = self.get_credential(credential_type, host, username)
        if cred:
            return decrypt(cred.encrypted_password)
        return None
    
    def get_credentials_by_type(self, credential_type: str) -> List[Credential]:
        return self.db.query(Credential).filter(
            Credential.credential_type == credential_type
        ).all()
    
    def get_credentials_by_host(self, host: str) -> List[Credential]:
        return self.db.query(Credential).filter(Credential.host == host).all()
    
    def get_all_credentials(self) -> List[Credential]:
        return self.db.query(Credential).all()
    
    def verify_credential(self, credential_type: str, host: str, username: str) -> bool:
        """Verify if credential exists and is valid"""
        cred = self.get_credential(credential_type, host, username)
        return cred is not None

    def delete_credential_by_id(self, credential_id: int) -> bool:
        cred = self.db.query(Credential).filter(Credential.id == credential_id).first()
        if not cred:
            return False
        self.db.delete(cred)
        self.db.commit()
        return True
