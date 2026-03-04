from dataclasses import dataclass
from datetime import datetime, timezone
import hashlib
import secrets
from typing import List, Optional, Tuple

from sqlalchemy.orm import Session

from app.models.openlineage_api_key import OpenLineageApiKey
from app.models.openlineage_api_key_policy import OpenLineageApiKeyPolicy


@dataclass
class ResolvedDbApiKey:
    key: OpenLineageApiKey
    policy: Optional[OpenLineageApiKeyPolicy]

    @property
    def fingerprint(self) -> str:
        return self.key.key_hash[:12]

    @property
    def allowed_job_namespaces(self) -> Optional[List[str]]:
        if not self.policy:
            return None
        values = self.policy.allowed_job_namespaces
        if isinstance(values, list):
            return [str(item).strip() for item in values if str(item).strip()]
        return None

    @property
    def allowed_dataset_namespaces(self) -> Optional[List[str]]:
        if not self.policy:
            return None
        values = self.policy.allowed_dataset_namespaces
        if isinstance(values, list):
            return [str(item).strip() for item in values if str(item).strip()]
        return None

    @property
    def requests_per_minute(self) -> Optional[int]:
        if not self.policy:
            return None
        return self.policy.requests_per_minute

    @property
    def requests_per_day(self) -> Optional[int]:
        if not self.policy:
            return None
        return self.policy.requests_per_day


class OpenLineageApiKeyService:
    def __init__(self, db: Session):
        self.db = db

    @staticmethod
    def generate_raw_key() -> str:
        return f"olk_{secrets.token_urlsafe(32)}"

    @staticmethod
    def hash_key(raw_key: str) -> str:
        return hashlib.sha256(raw_key.encode("utf-8")).hexdigest()

    @staticmethod
    def key_prefix(raw_key: str) -> str:
        return raw_key[:10]

    @staticmethod
    def _normalize_scope_list(values: Optional[List[str]]) -> Optional[List[str]]:
        if values is None:
            return None
        cleaned = []
        for item in values:
            value = str(item).strip()
            if value and value not in cleaned:
                cleaned.append(value)
        return cleaned if cleaned else []

    def _create_or_replace_policy(
        self,
        *,
        api_key_id: int,
        allowed_job_namespaces: Optional[List[str]],
        allowed_dataset_namespaces: Optional[List[str]],
        requests_per_minute: Optional[int],
        requests_per_day: Optional[int],
    ) -> OpenLineageApiKeyPolicy:
        existing = (
            self.db.query(OpenLineageApiKeyPolicy)
            .filter(OpenLineageApiKeyPolicy.api_key_id == api_key_id)
            .first()
        )

        normalized_job = self._normalize_scope_list(allowed_job_namespaces)
        normalized_dataset = self._normalize_scope_list(allowed_dataset_namespaces)

        if existing:
            existing.allowed_job_namespaces = normalized_job
            existing.allowed_dataset_namespaces = normalized_dataset
            existing.requests_per_minute = requests_per_minute
            existing.requests_per_day = requests_per_day
            return existing

        row = OpenLineageApiKeyPolicy(
            api_key_id=api_key_id,
            allowed_job_namespaces=normalized_job,
            allowed_dataset_namespaces=normalized_dataset,
            requests_per_minute=requests_per_minute,
            requests_per_day=requests_per_day,
        )
        self.db.add(row)
        return row

    def create_key(
        self,
        *,
        key_name: str,
        expires_at: Optional[datetime] = None,
        allowed_job_namespaces: Optional[List[str]] = None,
        allowed_dataset_namespaces: Optional[List[str]] = None,
        requests_per_minute: Optional[int] = None,
        requests_per_day: Optional[int] = None,
    ) -> Tuple[OpenLineageApiKey, str]:
        raw_key = self.generate_raw_key()
        row = OpenLineageApiKey(
            key_name=key_name.strip(),
            key_hash=self.hash_key(raw_key),
            key_prefix=self.key_prefix(raw_key),
            is_active=True,
            expires_at=expires_at,
        )
        self.db.add(row)
        self.db.flush()

        self._create_or_replace_policy(
            api_key_id=row.id,
            allowed_job_namespaces=allowed_job_namespaces,
            allowed_dataset_namespaces=allowed_dataset_namespaces,
            requests_per_minute=requests_per_minute,
            requests_per_day=requests_per_day,
        )

        self.db.commit()
        self.db.refresh(row)
        return row, raw_key

    def list_keys_with_policies(
        self,
        include_inactive: bool = True,
    ) -> List[Tuple[OpenLineageApiKey, Optional[OpenLineageApiKeyPolicy]]]:
        query = self.db.query(OpenLineageApiKey, OpenLineageApiKeyPolicy).outerjoin(
            OpenLineageApiKeyPolicy,
            OpenLineageApiKeyPolicy.api_key_id == OpenLineageApiKey.id,
        )
        if not include_inactive:
            query = query.filter(OpenLineageApiKey.is_active.is_(True))
        return query.order_by(OpenLineageApiKey.id.desc()).all()

    def get_key_with_policy(self, key_id: int) -> Optional[Tuple[OpenLineageApiKey, Optional[OpenLineageApiKeyPolicy]]]:
        row = (
            self.db.query(OpenLineageApiKey, OpenLineageApiKeyPolicy)
            .outerjoin(OpenLineageApiKeyPolicy, OpenLineageApiKeyPolicy.api_key_id == OpenLineageApiKey.id)
            .filter(OpenLineageApiKey.id == key_id)
            .first()
        )
        return row

    def get_key(self, key_id: int) -> Optional[OpenLineageApiKey]:
        row = self.get_key_with_policy(key_id)
        return row[0] if row else None

    def revoke_key(self, key_id: int) -> Optional[OpenLineageApiKey]:
        row = self.get_key(key_id)
        if not row:
            return None
        if row.is_active:
            row.is_active = False
            row.revoked_at = datetime.now(timezone.utc)
            self.db.commit()
            self.db.refresh(row)
        return row

    def rotate_key(
        self,
        *,
        key_id: int,
        expires_at: Optional[datetime] = None,
        allowed_job_namespaces: Optional[List[str]] = None,
        allowed_dataset_namespaces: Optional[List[str]] = None,
        requests_per_minute: Optional[int] = None,
        requests_per_day: Optional[int] = None,
    ) -> Optional[Tuple[OpenLineageApiKey, OpenLineageApiKey, str]]:
        current = self.get_key_with_policy(key_id)
        if not current:
            return None
        old_row, old_policy = current

        if old_row.is_active:
            old_row.is_active = False
            old_row.revoked_at = datetime.now(timezone.utc)

        next_job_scopes = (
            old_policy.allowed_job_namespaces if allowed_job_namespaces is None and old_policy else allowed_job_namespaces
        )
        next_dataset_scopes = (
            old_policy.allowed_dataset_namespaces
            if allowed_dataset_namespaces is None and old_policy
            else allowed_dataset_namespaces
        )
        next_rpm = old_policy.requests_per_minute if requests_per_minute is None and old_policy else requests_per_minute
        next_rpd = old_policy.requests_per_day if requests_per_day is None and old_policy else requests_per_day

        raw_key = self.generate_raw_key()
        new_row = OpenLineageApiKey(
            key_name=old_row.key_name,
            key_hash=self.hash_key(raw_key),
            key_prefix=self.key_prefix(raw_key),
            is_active=True,
            expires_at=expires_at if expires_at is not None else old_row.expires_at,
        )
        self.db.add(new_row)
        self.db.flush()

        self._create_or_replace_policy(
            api_key_id=new_row.id,
            allowed_job_namespaces=next_job_scopes,
            allowed_dataset_namespaces=next_dataset_scopes,
            requests_per_minute=next_rpm,
            requests_per_day=next_rpd,
        )

        self.db.commit()
        self.db.refresh(old_row)
        self.db.refresh(new_row)
        return old_row, new_row, raw_key

    def has_active_db_keys(self) -> bool:
        now = datetime.now(timezone.utc)
        return (
            self.db.query(OpenLineageApiKey)
            .filter(OpenLineageApiKey.is_active.is_(True))
            .filter((OpenLineageApiKey.expires_at.is_(None)) | (OpenLineageApiKey.expires_at > now))
            .count()
            > 0
        )

    def validate_db_key(self, raw_key: str) -> Optional[ResolvedDbApiKey]:
        now = datetime.now(timezone.utc)
        row = (
            self.db.query(OpenLineageApiKey, OpenLineageApiKeyPolicy)
            .outerjoin(OpenLineageApiKeyPolicy, OpenLineageApiKeyPolicy.api_key_id == OpenLineageApiKey.id)
            .filter(OpenLineageApiKey.key_hash == self.hash_key(raw_key))
            .filter(OpenLineageApiKey.is_active.is_(True))
            .filter((OpenLineageApiKey.expires_at.is_(None)) | (OpenLineageApiKey.expires_at > now))
            .first()
        )
        if not row:
            return None

        key_row, policy_row = row
        key_row.last_used_at = now
        self.db.commit()
        self.db.refresh(key_row)
        if policy_row:
            self.db.refresh(policy_row)
        return ResolvedDbApiKey(key=key_row, policy=policy_row)
