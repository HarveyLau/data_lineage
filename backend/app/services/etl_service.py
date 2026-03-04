from sqlalchemy.orm import Session
from app.models.etl_job import EtlJob
from app.models.etl_run import EtlRun
from typing import Optional, Dict, Any


class EtlService:
    def __init__(self, db: Session):
        self.db = db

    def get_or_create_job(self, job_name: str, source_type: str) -> EtlJob:
        job = self.db.query(EtlJob).filter(EtlJob.job_name == job_name).first()
        if job:
            return job
        job = EtlJob(job_name=job_name, source_type=source_type or "unknown")
        self.db.add(job)
        self.db.commit()
        self.db.refresh(job)
        return job

    def create_run(
        self,
        job_id: int,
        request_id: str,
        run_id: str,
        uploaded_filename: str,
        content_hash: str
    ) -> EtlRun:
        run = EtlRun(
            job_id=job_id,
            request_id=request_id,
            openlineage_run_id=run_id,
            uploaded_filename=uploaded_filename,
            content_hash=content_hash,
            status="STARTED",
        )
        self.db.add(run)
        self.db.commit()
        self.db.refresh(run)
        return run

    def update_run(
        self,
        run_id: int,
        status: str,
        error: Optional[str] = None,
        ended_at: Optional[Any] = None,
        missing_credentials_count: Optional[int] = None,
        parsed_summary: Optional[Dict[str, Any]] = None,
        lineage_summary: Optional[Dict[str, Any]] = None,
    ) -> EtlRun:
        run = self.db.query(EtlRun).filter(EtlRun.id == run_id).first()
        if not run:
            return None
        run.status = status
        if error is not None:
            run.error = error
        if ended_at is not None:
            run.ended_at = ended_at
        if missing_credentials_count is not None:
            run.missing_credentials_count = missing_credentials_count
        if parsed_summary is not None:
            run.parsed_summary = parsed_summary
        if lineage_summary is not None:
            run.lineage_summary = lineage_summary
        self.db.commit()
        self.db.refresh(run)
        return run
