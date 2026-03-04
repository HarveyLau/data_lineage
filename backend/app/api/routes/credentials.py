from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.services.credential_service import CredentialService
from pydantic import BaseModel
from typing import Optional, Dict, Any, Tuple
import paramiko
import psycopg2

router = APIRouter()

class CredentialCreate(BaseModel):
    credential_type: str = "SSH"
    host: str
    username: str
    password: str
    connection_params: Optional[Dict[str, Any]] = None
    description: Optional[str] = None

def _to_int(value: Any, default: int) -> int:
    try:
        return int(value)
    except (TypeError, ValueError):
        return default

def _validate_credential(cred: CredentialCreate) -> Tuple[bool, str]:
    credential_type = (cred.credential_type or "").upper()
    params = cred.connection_params or {}

    if credential_type == "SSH":
        port = _to_int(params.get("port"), 22)
        client = paramiko.SSHClient()
        client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        try:
            client.connect(
                hostname=cred.host,
                port=port,
                username=cred.username,
                password=cred.password,
                timeout=8,
            )
            return True, "SSH credential validated"
        except Exception as e:
            return False, f"SSH validation failed: {e}"
        finally:
            client.close()

    if credential_type in ("POSTGRES", "POSTGRESQL"):
        port = _to_int(params.get("port"), 5432)
        database = params.get("database") or "postgres"
        connection = None
        try:
            connection = psycopg2.connect(
                host=cred.host,
                port=port,
                database=database,
                user=cred.username,
                password=cred.password,
                connect_timeout=8,
            )
            return True, "PostgreSQL credential validated"
        except Exception as e:
            return False, f"PostgreSQL validation failed: {e}"
        finally:
            if connection:
                connection.close()

    if credential_type == "MYSQL":
        port = _to_int(params.get("port"), 3306)
        database = params.get("database")
        if not database:
            return False, "MySQL validation failed: connection_params.database is required"

        connection = None
        try:
            import pymysql

            connection = pymysql.connect(
                host=cred.host,
                port=port,
                user=cred.username,
                password=cred.password,
                database=database,
                connect_timeout=8,
            )
            return True, "MySQL credential validated"
        except ImportError:
            return False, "MySQL validation failed: pymysql is not installed"
        except Exception as e:
            return False, f"MySQL validation failed: {e}"
        finally:
            if connection:
                connection.close()

    if credential_type == "ORACLE":
        port = _to_int(params.get("port"), 1521)
        service_name = params.get("service_name")
        sid = params.get("sid")

        if not service_name and not sid:
            return False, "Oracle validation failed: provide connection_params.service_name or connection_params.sid"

        connection = None
        try:
            import oracledb

            if service_name:
                dsn = oracledb.makedsn(cred.host, port, service_name=service_name)
            else:
                dsn = oracledb.makedsn(cred.host, port, sid=sid)

            connection = oracledb.connect(
                user=cred.username,
                password=cred.password,
                dsn=dsn,
            )
            return True, "Oracle credential validated"
        except ImportError:
            return False, "Oracle validation failed: oracledb is not installed"
        except Exception as e:
            return False, f"Oracle validation failed: {e}"
        finally:
            if connection:
                connection.close()

    return False, f"Unsupported credential type for validation: {cred.credential_type}"

@router.post("/")
def create_credential(cred: CredentialCreate, db: Session = Depends(get_db)):
    ok, message = _validate_credential(cred)
    if not ok:
        raise HTTPException(status_code=400, detail=message)

    service = CredentialService(db)
    service.create_or_update_credential(
        credential_type=cred.credential_type,
        host=cred.host,
        username=cred.username,
        password=cred.password,
        connection_params=cred.connection_params,
        description=cred.description
    )
    return {"message": "Credential saved", "validation": "passed"}

@router.get("/")
def list_credentials(
    credential_type: Optional[str] = None,
    db: Session = Depends(get_db)
):
    service = CredentialService(db)
    if credential_type:
        creds = service.get_credentials_by_type(credential_type)
    else:
        creds = service.get_all_credentials()
    
    return {
        "credentials": [
            {
                "id": c.id,
                "credential_type": c.credential_type,
                "host": c.host,
                "username": c.username,
                "connection_params": c.connection_params,
                "description": c.description,
                "created_at": c.created_at.isoformat() if c.created_at else None
            }
            for c in creds
        ]
    }

@router.post("/verify")
def verify_credential(
    credential_type: str,
    host: str,
    username: str,
    db: Session = Depends(get_db)
):
    service = CredentialService(db)
    exists = service.verify_credential(credential_type, host, username)
    return {"exists": exists}

@router.delete("/{credential_id}")
def delete_credential(credential_id: int, db: Session = Depends(get_db)):
    service = CredentialService(db)
    ok = service.delete_credential_by_id(credential_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Credential not found")
    return {"message": "Credential deleted"}