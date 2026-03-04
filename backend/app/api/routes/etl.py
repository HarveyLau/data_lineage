from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.etl_job import EtlJob
from app.models.etl_run import EtlRun

router = APIRouter()


@router.get("/jobs")
def list_jobs(limit: int = 50, db: Session = Depends(get_db)):
    jobs = db.query(EtlJob).order_by(EtlJob.id.desc()).limit(limit).all()
    return {
        "jobs": [
            {
                "id": j.id,
                "job_name": j.job_name,
                "source_type": j.source_type,
                "created_at": j.created_at.isoformat() if j.created_at else None,
            }
            for j in jobs
        ]
    }


@router.get("/runs")
def list_runs(limit: int = 100, job_name: str | None = None, db: Session = Depends(get_db)):
    query = db.query(EtlRun, EtlJob).join(EtlJob, EtlRun.job_id == EtlJob.id)
    if job_name:
        query = query.filter(EtlJob.job_name == job_name)
    runs = query.order_by(EtlRun.id.desc()).limit(limit).all()
    return {
        "runs": [
            {
                "id": r.id,
                "job_id": r.job_id,
                "job_name": j.job_name,
                "source_type": j.source_type,
                "request_id": r.request_id,
                "openlineage_run_id": r.openlineage_run_id,
                "uploaded_filename": r.uploaded_filename,
                "content_hash": r.content_hash,
                "status": r.status,
                "error": r.error,
                "started_at": r.started_at.isoformat() if r.started_at else None,
                "ended_at": r.ended_at.isoformat() if r.ended_at else None,
                "missing_credentials_count": r.missing_credentials_count,
                "parsed_summary": r.parsed_summary,
                "lineage_summary": r.lineage_summary,
            }
            for r, j in runs
        ]
    }
