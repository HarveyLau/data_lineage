from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.openlineage_event import OpenLineageEvent, OpenLineageDatasetRef


class OpenLineageStoreService:
    def __init__(self, db: Session):
        self.db = db

    def persist_event(self, event: Dict[str, Any], request_id: Optional[str] = None) -> OpenLineageEvent:
        run_id = str(((event.get("run") or {}).get("runId") or "")).strip()
        if not run_id:
            raise ValueError("OpenLineage event missing run.runId")

        job = event.get("job") or {}
        event_row = OpenLineageEvent(
            request_id=request_id,
            run_id=run_id,
            job_namespace=str(job.get("namespace") or "default"),
            job_name=str(job.get("name") or "unknown"),
            event_type=str(event.get("eventType") or "UNKNOWN").upper(),
            event_time=self._parse_event_time(event.get("eventTime")),
            event_payload=event,
        )
        self.db.add(event_row)
        self.db.flush()

        dataset_rows = self._extract_dataset_refs(event, event_row.id)
        if dataset_rows:
            self.db.add_all(dataset_rows)

        self.db.commit()
        self.db.refresh(event_row)
        return event_row

    def list_events(
        self,
        *,
        run_id: Optional[str] = None,
        job_namespace: Optional[str] = None,
        job_name: Optional[str] = None,
        event_type: Optional[str] = None,
        dataset_namespace: Optional[str] = None,
        dataset_name: Optional[str] = None,
        since: Optional[datetime] = None,
        until: Optional[datetime] = None,
        limit: int = 100,
        offset: int = 0,
    ) -> Tuple[int, List[OpenLineageEvent]]:
        query = self.db.query(OpenLineageEvent)

        if dataset_namespace or dataset_name:
            dataset_query = self.db.query(OpenLineageDatasetRef.event_id)
            if dataset_namespace:
                dataset_query = dataset_query.filter(OpenLineageDatasetRef.dataset_namespace == dataset_namespace)
            if dataset_name:
                dataset_query = dataset_query.filter(OpenLineageDatasetRef.dataset_name == dataset_name)
            dataset_subquery = dataset_query.distinct().subquery()
            query = query.filter(OpenLineageEvent.id.in_(select(dataset_subquery.c.event_id)))

        if run_id:
            query = query.filter(OpenLineageEvent.run_id == run_id)
        if job_namespace:
            query = query.filter(OpenLineageEvent.job_namespace == job_namespace)
        if job_name:
            query = query.filter(OpenLineageEvent.job_name == job_name)
        if event_type:
            query = query.filter(OpenLineageEvent.event_type == event_type.upper())
        if since:
            query = query.filter(OpenLineageEvent.event_time >= since)
        if until:
            query = query.filter(OpenLineageEvent.event_time <= until)

        total = query.order_by(None).count()
        rows = (
            query.order_by(OpenLineageEvent.event_time.desc(), OpenLineageEvent.id.desc())
            .offset(offset)
            .limit(limit)
            .all()
        )
        return total, rows

    def list_run_events(self, run_id: str) -> List[OpenLineageEvent]:
        return (
            self.db.query(OpenLineageEvent)
            .filter(OpenLineageEvent.run_id == run_id)
            .order_by(OpenLineageEvent.event_time.asc(), OpenLineageEvent.id.asc())
            .all()
        )

    @staticmethod
    def _parse_event_time(value: Any) -> datetime:
        if isinstance(value, datetime):
            return value

        if isinstance(value, str):
            candidate = value.strip()
            if candidate.endswith("Z"):
                candidate = candidate[:-1] + "+00:00"
            try:
                parsed = datetime.fromisoformat(candidate)
                if parsed.tzinfo is None:
                    return parsed.replace(tzinfo=timezone.utc)
                return parsed
            except ValueError:
                pass

        return datetime.now(timezone.utc)

    @staticmethod
    def _extract_dataset_refs(event: Dict[str, Any], event_id: int) -> List[OpenLineageDatasetRef]:
        rows: List[OpenLineageDatasetRef] = []
        rows.extend(OpenLineageStoreService._datasets_for_role(event_id, event.get("inputs"), "INPUT"))
        rows.extend(OpenLineageStoreService._datasets_for_role(event_id, event.get("outputs"), "OUTPUT"))
        return rows

    @staticmethod
    def _datasets_for_role(event_id: int, datasets: Any, role: str) -> List[OpenLineageDatasetRef]:
        if not isinstance(datasets, list):
            return []

        rows: List[OpenLineageDatasetRef] = []
        for item in datasets:
            if not isinstance(item, dict):
                continue

            namespace = str(item.get("namespace") or "").strip()
            name = str(item.get("name") or "").strip()
            if not namespace or not name:
                continue

            rows.append(
                OpenLineageDatasetRef(
                    event_id=event_id,
                    role=role,
                    dataset_namespace=namespace,
                    dataset_name=name,
                )
            )
        return rows
