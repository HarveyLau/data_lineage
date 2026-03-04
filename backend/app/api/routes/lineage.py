from fastapi import APIRouter, UploadFile, File, Depends, HTTPException
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.services.parser_service import ParserService
from app.services.ai_service import AiService
from app.services.gravitino_service import GravitinoService
from app.services.mcp_service import McpService, CredentialMissingError
from app.services.credential_service import CredentialService
from app.services.data_source_factory import DataSourceFactory
from app.services.marquez_service import MarquezService
from app.utils.openlineage_converter import OpenLineageConverter
from app.services.etl_service import EtlService
from app.services.openlineage_store_service import OpenLineageStoreService
from typing import List, Dict, Any
import uuid
import re
import hashlib
from datetime import datetime

def _safe_schema(value: str) -> str:
    if not value:
        return "public"
    safe = re.sub(r"[^a-zA-Z0-9_]", "_", value)
    return safe or "public"

def _truncate_text(value: Any, max_length: int = 180) -> str:
    text = re.sub(r"\s+", " ", str(value or "")).strip()
    if len(text) <= max_length:
        return text
    return text[: max_length - 1] + "…"

def _extract_key_lines(content: str, max_lines: int = 5) -> List[str]:
    lines = [line.strip() for line in content.splitlines() if line.strip()]
    if not lines:
        return []

    keywords = (
        "input_file",
        "output_file",
        "db_",
        "libname",
        "set ",
        "join ",
        "from ",
        "select ",
        "insert ",
        "create ",
        "read_csv",
        "outfile",
        "table",
    )
    selected = []
    for line in lines:
        lower_line = line.lower()
        if any(keyword in lower_line for keyword in keywords):
            selected.append(_truncate_text(line))
        if len(selected) >= max_lines:
            break

    if not selected:
        selected = [_truncate_text(line) for line in lines[:max_lines]]
    return selected

def _format_entities(entities: List[Dict[str, Any]], max_items: int = 4) -> str:
    if not entities:
        return "无"

    formatted = []
    for entity in entities[:max_items]:
        name = _truncate_text(entity.get("name", "unknown"), 80)
        entity_type = entity.get("type", "dataset")
        system = entity.get("database") or entity.get("location") or entity.get("host") or entity.get("path")
        if system:
            formatted.append(f"{name}({entity_type}, {_truncate_text(system, 80)})")
        else:
            formatted.append(f"{name}({entity_type})")

    remaining = len(entities) - len(formatted)
    if remaining > 0:
        formatted.append(f"另外 {remaining} 个")
    return "；".join(formatted)

def _collect_systems(parsed_data: Dict[str, Any], lineage_data: Dict[str, Any]) -> List[str]:
    systems = set()

    for resource in parsed_data.get("remote_resources", []):
        host = resource.get("host")
        if host:
            systems.add(host)

    for db_conn in parsed_data.get("database_connections", []):
        database = db_conn.get("database")
        host = db_conn.get("host")
        if database:
            systems.add(database)
        elif host:
            systems.add(host)

    for entity in lineage_data.get("sources", []) + lineage_data.get("targets", []):
        system = entity.get("database") or entity.get("location")
        if system:
            systems.add(str(system))

    return sorted([_truncate_text(system, 80) for system in systems if system])

def _build_dynamic_analysis_explanation(
    file_name: str,
    content: str,
    parsed_data: Dict[str, Any],
    lineage_data: Dict[str, Any],
    accessed_resources: List[Dict[str, Any]],
    ai_steps: List[str],
) -> List[str]:
    file_type = parsed_data.get("type", "script")
    line_count = len(content.splitlines())
    key_lines = _extract_key_lines(content)
    preview_block = "\n".join([f"- {line}" for line in key_lines]) if key_lines else "- 未捕获到关键文本片段"

    jobs = parsed_data.get("jobs", [])
    job_names = [job.get("jobname") for job in jobs if isinstance(job, dict) and job.get("jobname")]
    job_summary = "，".join([_truncate_text(name, 60) for name in job_names[:3]]) if job_names else "未识别到显式 job 名称"

    sources = lineage_data.get("sources", [])
    targets = lineage_data.get("targets", [])
    systems = _collect_systems(parsed_data, lineage_data)

    steps = [
        f"已读取导入文件 {file_name}（类型: {file_type}，约 {line_count} 行）。",
        f"文件关键内容片段：\n{preview_block}",
        f"解析阶段识别到的作业信息：{job_summary}",
        f"AI 识别来源实体 {len(sources)} 个：{_format_entities(sources)}",
        f"AI 识别目标实体 {len(targets)} 个：{_format_entities(targets)}",
    ]

    if systems:
        shown = "，".join(systems[:6])
        suffix = " 等" if len(systems) > 6 else ""
        steps.append(f"本次血缘涉及系统：{shown}{suffix}")

    if accessed_resources:
        accessed_count = len([item for item in accessed_resources if item.get("status") == "accessed"])
        error_count = len([item for item in accessed_resources if item.get("status") == "error"])
        steps.append(
            f"远程资源访问结果：成功 {accessed_count} 个，失败 {error_count} 个；这些结果已纳入血缘分析上下文。"
        )

    steps.append("已将识别到的 source/target 关系映射为 OpenLineage 事件，并写入元数据注册流程。")

    if ai_steps:
        steps.extend([_truncate_text(step, 220) for step in ai_steps[:3]])

    deduped = []
    seen = set()
    for step in steps:
        clean_step = str(step).strip()
        if clean_step and clean_step not in seen:
            seen.add(clean_step)
            deduped.append(clean_step)
    return deduped[:10]

def _missing_credential_key(item: Dict[str, Any]) -> tuple:
    credential_type = str(item.get("type", "")).strip().upper()
    host = str(item.get("host", "")).strip().lower()
    username = str(item.get("username", "")).strip()
    return (credential_type, host, username)

def _add_missing_credential(
    missing_credentials: List[Dict[str, Any]],
    seen_missing_credentials: set,
    item: Dict[str, Any],
) -> None:
    key = _missing_credential_key(item)
    resource_parts = []
    if item.get("resource"):
        resource_parts.append(str(item.get("resource")))
    elif item.get("database") or item.get("table"):
        database = str(item.get("database") or "")
        table = str(item.get("table") or "")
        if database and table:
            resource_parts.append(f"{database}.{table}")
        elif database:
            resource_parts.append(database)
        elif table:
            resource_parts.append(table)

    if key not in seen_missing_credentials:
        seen_missing_credentials.add(key)
        base_item = dict(item)
        if resource_parts:
            base_item["resources"] = resource_parts
        missing_credentials.append(base_item)
        return

    for existing_item in missing_credentials:
        if _missing_credential_key(existing_item) != key:
            continue

        existing_resources = existing_item.get("resources", [])
        if not isinstance(existing_resources, list):
            existing_resources = []

        for resource in resource_parts:
            if resource and resource not in existing_resources:
                existing_resources.append(resource)

        if existing_resources:
            existing_item["resources"] = existing_resources

        for field in ("database", "table", "reason", "error"):
            if not existing_item.get(field) and item.get(field):
                existing_item[field] = item.get(field)
        return

router = APIRouter()

@router.get("/ping")
def ping():
    return {"status": "pong", "service": "lineage"}

@router.post("/upload")
async def upload_file(
    file: UploadFile = File(...), 
    db: Session = Depends(get_db)
):
    request_id = str(uuid.uuid4())
    print(f"[{request_id}] Received upload request for file: {file.filename}")
    content = await file.read()
    content_str = content.decode("utf-8")
    content_hash = hashlib.sha256(content).hexdigest()
    
    credential_service = CredentialService(db)
    openlineage_store = OpenLineageStoreService(db)
    missing_credentials = []
    seen_missing_credentials = set()
    accessed_resources = []
    
    # 1. Parse File
    parsed_data = ParserService.parse_file(file.filename, content_str)
    
    if parsed_data.get("type") == "error":
        raise HTTPException(status_code=400, detail=parsed_data.get("message"))

    # 1.2. Determine Job Identity + create Job/Run
    etl_service = EtlService(db)
    job_name = file.filename
    source_type = parsed_data.get("type", "script")
    if parsed_data.get("type") == "control-m":
        jobs = parsed_data.get("jobs", [])
        if jobs and jobs[0].get("jobname"):
            job_name = jobs[0].get("jobname")
    etl_job = etl_service.get_or_create_job(job_name=job_name, source_type=source_type)
    openlineage_run_id = str(uuid.uuid4())
    run = etl_service.create_run(
        job_id=etl_job.id,
        request_id=request_id,
        run_id=openlineage_run_id,
        uploaded_filename=file.filename,
        content_hash=content_hash
    )

    def _persist_openlineage_event(event_payload: Dict[str, Any], stage: str, raise_on_failure: bool = True) -> None:
        try:
            openlineage_store.persist_event(event_payload, request_id=request_id)
        except Exception as e:
            if raise_on_failure:
                raise HTTPException(
                    status_code=500,
                    detail=f"[{request_id}] Failed to persist {stage} OpenLineage event: {e}",
                )
            print(f"[{request_id}] Failed to persist {stage} OpenLineage event: {e}")

    # Build OpenLineage facets
    job_facets = {}
    if parsed_data.get("type") == "control-m":
        job = (parsed_data.get("jobs") or [{}])[0]
        job_facets["controlm"] = {
            "_producer": "https://github.com/ai-data-lineage/producer",
            "_schemaURL": "https://openlineage.io/spec/1-0-5/OpenLineage.json#/$defs/JobFacet",
            "jobname": job.get("jobname"),
            "nodeid": job.get("nodeid"),
            "cmdline": job.get("cmdline"),
            "memname": job.get("memname")
        }

    run_facets = {
        "fileUpload": {
            "_producer": "https://github.com/ai-data-lineage/producer",
            "_schemaURL": "https://openlineage.io/spec/1-0-5/OpenLineage.json#/$defs/RunFacet",
            "filename": file.filename,
            "sha256": content_hash
        }
    }

    namespace = "data_lineage_app"

    # Emit START event
    marquez = MarquezService()
    start_time = datetime.utcnow()
    start_event = OpenLineageConverter.build_run_event(
        event_type="START",
        job_name=job_name,
        run_id=openlineage_run_id,
        event_time=start_time,
        namespace=namespace,
        job_facets=job_facets,
        run_facets=run_facets
    )
    _persist_openlineage_event(start_event, "START")
    marquez.send_lineage(start_event)

    # 1.5. Access Remote Resources if Control-M XML
    if parsed_data.get("type") == "control-m":
        remote_resources = parsed_data.get("remote_resources", [])
        db_connections = parsed_data.get("database_connections", [])
        
        # Access remote files
        for resource in remote_resources:
            host = resource.get("host")
            path = resource.get("path")
            try:
                # Try to find SSH credential
                cred = credential_service.get_credential("SSH", host, "sasuser")  # Default username
                if not cred:
                    _add_missing_credential(missing_credentials, seen_missing_credentials, {
                        "type": "SSH",
                        "host": host,
                        "username": "sasuser",
                        "resource": f"File: {path}",
                        "reason": "SSH credential not found"
                    })
                else:
                    # Access the file
                    try:
                        ds = DataSourceFactory.create_from_credential(credential_service, cred)
                        if ds and ds.connect():
                            file_content = ds.read_file(path)
                            accessed_resources.append({
                                "type": "file",
                                "host": host,
                                "path": path,
                                "size": len(file_content),
                                "status": "accessed"
                            })
                            ds.disconnect()
                    except Exception as e:
                        accessed_resources.append({
                            "type": "file",
                            "host": host,
                            "path": path,
                            "status": "error",
                            "error": str(e)
                        })
            except Exception as e:
                _add_missing_credential(missing_credentials, seen_missing_credentials, {
                    "type": "SSH",
                    "host": host,
                    "username": "sasuser",
                    "resource": f"File: {path}",
                    "error": str(e)
                })
        
        # Access database tables
        for db_conn in db_connections:
            host = db_conn.get("host")
            database = db_conn.get("database")
            table = db_conn.get("table")
            
            try:
                # Try to find database credential
                cred = credential_service.get_credential("POSTGRES", host, "seeduser")  # Default username
                if not cred:
                    _add_missing_credential(missing_credentials, seen_missing_credentials, {
                        "type": "POSTGRES",
                        "host": host,
                        "database": database,
                        "table": table,
                        "username": "seeduser",
                        "reason": "Database credential not found"
                    })
                else:
                    # Query the table
                    try:
                        ds = DataSourceFactory.create_from_credential(credential_service, cred)
                        if ds and ds.connect():
                            rows = ds.query_table(table, db_conn.get("schema"), limit=10)
                            accessed_resources.append({
                                "type": "database",
                                "host": host,
                                "database": database,
                                "table": table,
                                "rows_accessed": len(rows),
                                "status": "accessed"
                            })
                            ds.disconnect()
                    except Exception as e:
                        accessed_resources.append({
                            "type": "database",
                            "host": host,
                            "database": database,
                            "table": table,
                            "status": "error",
                            "error": str(e)
                        })
            except Exception as e:
                _add_missing_credential(missing_credentials, seen_missing_credentials, {
                    "type": "POSTGRES",
                    "host": host,
                    "database": database,
                    "username": "seeduser",
                    "error": str(e)
                })
    
    try:
        # 2. AI Analysis (enhanced with accessed resources info)
        ai_service = AiService()
        lineage_data = ai_service.analyze_script(content_str, parsed_data.get("type", "script"))
    
        # Enhance lineage data with accessed resources
        if accessed_resources:
            lineage_data["accessed_resources"] = accessed_resources

        # Build human-readable analysis explanation steps
        ai_explanation_steps = []
        if isinstance(lineage_data, dict):
            raw_steps = lineage_data.get("explanation_steps")
            if isinstance(raw_steps, list):
                ai_explanation_steps = [str(step) for step in raw_steps if step]

        analysis_explanation = _build_dynamic_analysis_explanation(
            file_name=file.filename,
            content=content_str,
            parsed_data=parsed_data,
            lineage_data=lineage_data if isinstance(lineage_data, dict) else {"sources": [], "targets": []},
            accessed_resources=accessed_resources,
            ai_steps=ai_explanation_steps,
        )
    
        # 3. Store in Gravitino
        gravitino = GravitinoService()
        try:
            gravitino.init_metalake()
            gravitino.create_catalog()
        except Exception as e:
            # Provide a clearer server-side error and keep request_id for correlation
            raise HTTPException(status_code=500, detail=f"[{request_id}] Gravitino init/catalog failed: {e}")
    
        results = []
    
    # Register remote file resources (e.g., SSH files) with host-based schema for visibility
        for resource in parsed_data.get("remote_resources", []):
            if resource.get("type") != "file":
                continue
            host = resource.get("host") or "public"
            path = resource.get("path") or "unknown_file"
            schema = _safe_schema(host)
            try:
                gravitino.register_dataset(path, schema=schema, dataset_type="file")
                results.append(f"File: {path} (schema={schema})")
            except Exception as e:
                raise HTTPException(status_code=500, detail=f"[{request_id}] Gravitino register file failed ({path}): {e}")

    # Register sources
        for source in lineage_data.get("sources", []):
            name = source.get("name")
            try:
                gravitino.register_dataset(name)
                results.append(f"Source: {name}")
            except Exception as e:
                raise HTTPException(status_code=500, detail=f"[{request_id}] Gravitino register source failed ({name}): {e}")

    # Register targets
        for target in lineage_data.get("targets", []):
            name = target.get("name")
            try:
                gravitino.register_dataset(name)
                results.append(f"Target: {name}")
            except Exception as e:
                raise HTTPException(status_code=500, detail=f"[{request_id}] Gravitino register target failed ({name}): {e}")
    
        # 4. Convert to OpenLineage
        extra_inputs = []
        extra_outputs = []
        for resource in parsed_data.get("remote_resources", []):
            item = {
                "namespace": resource.get("host") or namespace,
                "name": resource.get("path"),
                "path": resource.get("path"),
            }
            if resource.get("direction") == "output":
                extra_outputs.append(item)
            else:
                extra_inputs.append(item)
        for db_conn in parsed_data.get("database_connections", []):
            item = {
                "namespace": db_conn.get("database") or db_conn.get("host") or namespace,
                "name": db_conn.get("table") or "unknown",
                "path": f"{db_conn.get('schema', 'public')}.{db_conn.get('table')}" if db_conn.get("table") else None,
            }
            extra_inputs.append(item)

        end_time = datetime.utcnow()
        complete_event = OpenLineageConverter.build_run_event(
            event_type="COMPLETE",
            job_name=job_name,
            run_id=openlineage_run_id,
            event_time=end_time,
            namespace=namespace,
            job_facets=job_facets,
            run_facets=run_facets,
            inputs=OpenLineageConverter._build_datasets(lineage_data.get("sources", []), namespace) + OpenLineageConverter._build_datasets(extra_inputs, namespace),
            outputs=OpenLineageConverter._build_datasets(lineage_data.get("targets", []), namespace) + OpenLineageConverter._build_datasets(extra_outputs, namespace),
        )

        _persist_openlineage_event(complete_event, "COMPLETE")
        marquez_status = "Skipped"
        if marquez.send_lineage(complete_event):
            marquez_status = "Sent"
        else:
            marquez_status = "Failed"

        etl_service.update_run(
            run_id=run.id,
            status="COMPLETED",
            ended_at=end_time,
            missing_credentials_count=len(missing_credentials),
            parsed_summary={
                "type": parsed_data.get("type"),
                "jobs": parsed_data.get("jobs", [])[:1],
                "remote_resources_count": len(parsed_data.get("remote_resources", [])),
                "database_connections_count": len(parsed_data.get("database_connections", [])),
            },
            lineage_summary={
                "sources_count": len(lineage_data.get("sources", [])),
                "targets_count": len(lineage_data.get("targets", [])),
            },
        )
        
        return {
            "parsed": parsed_data,
            "lineage": lineage_data,
            "openlineage": complete_event,
            "openlineage_storage_status": "Stored",
            "gravitino_status": "Registered",
            "marquez_status": marquez_status,
            "missing_credentials": missing_credentials,
            "accessed_resources": accessed_resources,
            "details": results,
            "job": {"name": job_name, "run_id": openlineage_run_id},
            "analysis_explanation": analysis_explanation,
        }
    except HTTPException as e:
        fail_time = datetime.utcnow()
        fail_event = OpenLineageConverter.build_run_event(
            event_type="FAIL",
            job_name=job_name,
            run_id=openlineage_run_id,
            event_time=fail_time,
            namespace=namespace,
            job_facets=job_facets,
            run_facets=run_facets
        )
        _persist_openlineage_event(fail_event, "FAIL", raise_on_failure=False)
        marquez.send_lineage(fail_event)
        etl_service.update_run(
            run_id=run.id,
            status="FAILED",
            ended_at=fail_time,
            error=str(e.detail)
        )
        raise
    except Exception as e:
        fail_time = datetime.utcnow()
        fail_event = OpenLineageConverter.build_run_event(
            event_type="FAIL",
            job_name=job_name,
            run_id=openlineage_run_id,
            event_time=fail_time,
            namespace=namespace,
            job_facets=job_facets,
            run_facets=run_facets
        )
        _persist_openlineage_event(fail_event, "FAIL", raise_on_failure=False)
        marquez.send_lineage(fail_event)
        etl_service.update_run(
            run_id=run.id,
            status="FAILED",
            ended_at=fail_time,
            error=str(e)
        )
        raise

@router.post("/data-sources/read-file")
async def read_file(
    credential_type: str,
    host: str,
    username: str,
    path: str,
    db: Session = Depends(get_db)
):
    """Read a file from a remote data source"""
    credential_service = CredentialService(db)
    cred = credential_service.get_credential(credential_type, host, username)
    
    if not cred:
        raise HTTPException(status_code=404, detail="Credential not found")
    
    try:
        ds = DataSourceFactory.create_from_credential(credential_service, cred)
        if not ds.connect():
            raise HTTPException(status_code=500, detail="Failed to connect to data source")
        
        content = ds.read_file(path)
        ds.disconnect()
        
        return {
            "path": path,
            "content": content[:1000],  # Limit response size
            "size": len(content)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/data-sources/query")
async def query_table(
    credential_type: str,
    host: str,
    username: str,
    table_name: str,
    database: str,
    schema: str = "public",
    limit: int = 100,
    db: Session = Depends(get_db)
):
    """Query a table from a database data source"""
    credential_service = CredentialService(db)
    cred = credential_service.get_credential(credential_type, host, username)
    
    if not cred:
        raise HTTPException(status_code=404, detail="Credential not found")
    
    try:
        # Update connection params if needed
        if not cred.connection_params:
            cred.connection_params = {}
        cred.connection_params["database"] = database
        
        ds = DataSourceFactory.create_from_credential(credential_service, cred)
        if not ds.connect():
            raise HTTPException(status_code=500, detail="Failed to connect to data source")
        
        rows = ds.query_table(table_name, schema, limit)
        ds.disconnect()
        
        return {
            "table": table_name,
            "schema": schema,
            "rows": rows,
            "count": len(rows)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/data-sources/types")
def get_data_source_types():
    """Get list of supported data source types"""
    return {
        "types": [
            {"value": "SSH", "label": "SSH (Remote Server)", "supports_file": True, "supports_table": False},
            {"value": "POSTGRES", "label": "PostgreSQL", "supports_file": False, "supports_table": True},
            {"value": "ORACLE", "label": "Oracle Database", "supports_file": False, "supports_table": True},
            {"value": "MYSQL", "label": "MySQL", "supports_file": False, "supports_table": True},
        ]
    }

@router.post("/discover")
async def discover_script(
    host: str, 
    script_name: str, 
    username: str,
    db: Session = Depends(get_db)
):
    cred_service = CredentialService(db)
    mcp_service = McpService(cred_service)
    
    try:
        scripts = mcp_service.find_script(host, username, script_name)
        return {"host": host, "scripts": scripts}
    except CredentialMissingError as e:
        raise HTTPException(status_code=401, detail=f"Credentials needed for {e.host}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
