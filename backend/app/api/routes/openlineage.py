from datetime import datetime
from typing import Any, Dict, Optional, Set

from fastapi import APIRouter, Depends, HTTPException, Query, Request

from app.api.deps.openlineage_auth import OpenLineageRequestContext, require_openlineage_api_key
from app.services.openlineage_access_audit_service import OpenLineageAccessAuditService
from app.services.openlineage_store_service import OpenLineageStoreService


router = APIRouter()


def _clamp_limit(limit: int) -> int:
    return max(1, min(limit, 500))


def _serialize_event(row: Any, include_payload: bool = True) -> Dict[str, Any]:
    item: Dict[str, Any] = {
        "id": row.id,
        "request_id": row.request_id,
        "run_id": row.run_id,
        "event_type": row.event_type,
        "event_time": row.event_time.isoformat() if row.event_time else None,
        "job": {
            "namespace": row.job_namespace,
            "name": row.job_name,
        },
    }
    if include_payload:
        item["payload"] = row.event_payload
    return item


def _audit_access(
    request: Request,
    ctx: OpenLineageRequestContext,
    *,
    status_code: int,
    allowed: bool,
    denial_reason: Optional[str] = None,
) -> None:
    try:
        OpenLineageAccessAuditService(ctx.db).record(
            request_id=ctx.auth.request_id,
            endpoint=request.url.path,
            http_method=request.method,
            query_params=dict(request.query_params),
            status_code=status_code,
            allowed=allowed,
            denial_reason=denial_reason,
            auth_source=ctx.auth.auth_source,
            api_key_fingerprint=ctx.auth.api_key_fingerprint,
            client_ip=request.client.host if request.client else None,
            user_agent=request.headers.get("user-agent"),
        )
    except Exception as e:
        print(f"[{ctx.auth.request_id}] Failed to write openlineage access audit: {e}")


def _normalize_scope(values: Optional[list[str]]) -> Set[str]:
    if not values:
        return set()
    return {str(item).strip() for item in values if str(item).strip()}


def _deny_scope(request: Request, ctx: OpenLineageRequestContext, reason: str) -> None:
    _audit_access(request, ctx, status_code=403, allowed=False, denial_reason=reason)
    raise HTTPException(status_code=403, detail=reason)


def _enforce_namespace_scope(
    request: Request,
    ctx: OpenLineageRequestContext,
    *,
    job_namespace: Optional[str] = None,
    dataset_namespace: Optional[str] = None,
    require_any_filter_for_scoped_key: bool = False,
) -> None:
    allowed_job_scopes = _normalize_scope(ctx.auth.allowed_job_namespaces)
    allowed_dataset_scopes = _normalize_scope(ctx.auth.allowed_dataset_namespaces)
    is_scoped = bool(allowed_job_scopes or allowed_dataset_scopes)
    if not is_scoped:
        return

    if require_any_filter_for_scoped_key and not job_namespace and not dataset_namespace:
        _deny_scope(request, ctx, "Scoped API key must include namespace filters")

    if job_namespace and allowed_job_scopes and job_namespace not in allowed_job_scopes:
        _deny_scope(request, ctx, f"job_namespace not allowed: {job_namespace}")

    if dataset_namespace and allowed_dataset_scopes and dataset_namespace not in allowed_dataset_scopes:
        _deny_scope(request, ctx, f"dataset_namespace not allowed: {dataset_namespace}")


def _extract_dataset_namespaces(payload: Any) -> Set[str]:
    if not isinstance(payload, dict):
        return set()

    values = set()
    for side in ("inputs", "outputs"):
        items = payload.get(side)
        if not isinstance(items, list):
            continue
        for entry in items:
            if not isinstance(entry, dict):
                continue
            ns = str(entry.get("namespace") or "").strip()
            if ns:
                values.add(ns)
    return values


def _enforce_run_scope(
    request: Request,
    ctx: OpenLineageRequestContext,
    run_rows: list[Any],
) -> None:
    allowed_job_scopes = _normalize_scope(ctx.auth.allowed_job_namespaces)
    allowed_dataset_scopes = _normalize_scope(ctx.auth.allowed_dataset_namespaces)
    is_scoped = bool(allowed_job_scopes or allowed_dataset_scopes)
    if not is_scoped:
        return

    for row in run_rows:
        if allowed_job_scopes and row.job_namespace not in allowed_job_scopes:
            _deny_scope(request, ctx, f"run contains disallowed job_namespace: {row.job_namespace}")

        if allowed_dataset_scopes:
            dataset_namespaces = _extract_dataset_namespaces(row.event_payload)
            disallowed = [ns for ns in dataset_namespaces if ns not in allowed_dataset_scopes]
            if disallowed:
                _deny_scope(request, ctx, f"run contains disallowed dataset_namespace: {disallowed[0]}")


@router.get("/events")
def list_events(
    run_id: Optional[str] = None,
    job_namespace: Optional[str] = None,
    job_name: Optional[str] = None,
    event_type: Optional[str] = None,
    dataset_namespace: Optional[str] = None,
    dataset_name: Optional[str] = None,
    since: Optional[datetime] = None,
    until: Optional[datetime] = None,
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    include_payload: bool = True,
    request: Request = None,
    ctx: OpenLineageRequestContext = Depends(require_openlineage_api_key),
):
    _enforce_namespace_scope(
        request,
        ctx,
        job_namespace=job_namespace,
        dataset_namespace=dataset_namespace,
        require_any_filter_for_scoped_key=True,
    )
    service = OpenLineageStoreService(ctx.db)
    bounded_limit = _clamp_limit(limit)
    total, rows = service.list_events(
        run_id=run_id,
        job_namespace=job_namespace,
        job_name=job_name,
        event_type=event_type,
        dataset_namespace=dataset_namespace,
        dataset_name=dataset_name,
        since=since,
        until=until,
        limit=bounded_limit,
        offset=offset,
    )
    _audit_access(request, ctx, status_code=200, allowed=True)
    return {
        "total": total,
        "limit": bounded_limit,
        "offset": offset,
        "events": [_serialize_event(row, include_payload=include_payload) for row in rows],
    }


@router.get("/runs/{run_id}")
def get_run_events(
    run_id: str,
    include_payload: bool = True,
    request: Request = None,
    ctx: OpenLineageRequestContext = Depends(require_openlineage_api_key),
):
    service = OpenLineageStoreService(ctx.db)
    rows = service.list_run_events(run_id)
    if not rows:
        _audit_access(request, ctx, status_code=404, allowed=True, denial_reason="run not found")
        raise HTTPException(status_code=404, detail=f"No OpenLineage events found for run_id={run_id}")

    _enforce_run_scope(request, ctx, rows)
    _audit_access(request, ctx, status_code=200, allowed=True)
    return {
        "run_id": run_id,
        "event_count": len(rows),
        "events": [_serialize_event(row, include_payload=include_payload) for row in rows],
    }


@router.get("/jobs/{job_namespace}/{job_name}")
def get_job_events(
    job_namespace: str,
    job_name: str,
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    include_payload: bool = True,
    request: Request = None,
    ctx: OpenLineageRequestContext = Depends(require_openlineage_api_key),
):
    _enforce_namespace_scope(request, ctx, job_namespace=job_namespace)
    service = OpenLineageStoreService(ctx.db)
    bounded_limit = _clamp_limit(limit)
    total, rows = service.list_events(
        job_namespace=job_namespace,
        job_name=job_name,
        limit=bounded_limit,
        offset=offset,
    )
    _audit_access(request, ctx, status_code=200, allowed=True)
    return {
        "job": {"namespace": job_namespace, "name": job_name},
        "total": total,
        "limit": bounded_limit,
        "offset": offset,
        "events": [_serialize_event(row, include_payload=include_payload) for row in rows],
    }


@router.get("/jobs/events")
def get_job_events_by_query(
    job_namespace: str,
    job_name: str,
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    include_payload: bool = True,
    request: Request = None,
    ctx: OpenLineageRequestContext = Depends(require_openlineage_api_key),
):
    return get_job_events(
        job_namespace=job_namespace,
        job_name=job_name,
        limit=limit,
        offset=offset,
        include_payload=include_payload,
        request=request,
        ctx=ctx,
    )


@router.get("/datasets/{dataset_namespace}/{dataset_name}/events")
def get_dataset_events(
    dataset_namespace: str,
    dataset_name: str,
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    include_payload: bool = True,
    request: Request = None,
    ctx: OpenLineageRequestContext = Depends(require_openlineage_api_key),
):
    _enforce_namespace_scope(request, ctx, dataset_namespace=dataset_namespace)
    service = OpenLineageStoreService(ctx.db)
    bounded_limit = _clamp_limit(limit)
    total, rows = service.list_events(
        dataset_namespace=dataset_namespace,
        dataset_name=dataset_name,
        limit=bounded_limit,
        offset=offset,
    )
    _audit_access(request, ctx, status_code=200, allowed=True)
    return {
        "dataset": {"namespace": dataset_namespace, "name": dataset_name},
        "total": total,
        "limit": bounded_limit,
        "offset": offset,
        "events": [_serialize_event(row, include_payload=include_payload) for row in rows],
    }


@router.get("/datasets/events")
def get_dataset_events_by_query(
    dataset_namespace: str,
    dataset_name: str,
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    include_payload: bool = True,
    request: Request = None,
    ctx: OpenLineageRequestContext = Depends(require_openlineage_api_key),
):
    return get_dataset_events(
        dataset_namespace=dataset_namespace,
        dataset_name=dataset_name,
        limit=limit,
        offset=offset,
        include_payload=include_payload,
        request=request,
        ctx=ctx,
    )
