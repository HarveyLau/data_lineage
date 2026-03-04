from typing import Dict, Any, List
from datetime import datetime, timezone
import uuid
from app.models.openlineage import OpenLineageRunEvent, OpenLineageRun, OpenLineageJob, OpenLineageDataset

class OpenLineageConverter:
    @staticmethod
    def _get_namespace(item: Dict[str, Any]) -> str:
        # Heuristic to determine namespace
        # If database is provided, use it as part of namespace context or scheme
        # Otherwise use a default or file scheme
        if item.get("type") == "table":
            db = item.get("database", "default")
            # For simplicity, we use a generic db namespace. 
            # In real world, this might be 'postgres://host:port'
            return f"database://{db}"
        else:
            # File system
            location = item.get("location", "")
            if "://" in location:
                return location.split("://")[0] + "://" + location.split("://")[1].split("/")[0]
            return "file://local"

    @staticmethod
    def _get_name(item: Dict[str, Any]) -> str:
        # Ideally full path for files, schema.table for DBs
        if item.get("type") == "table":
            db = item.get("database")
            name = item.get("name")
            if db and "." not in name:
                return f"{db}.{name}"
            return name
        else:
            return item.get("path") or item.get("name")

    @staticmethod
    def convert(
        ai_result: Dict[str, Any], 
        job_name: str, 
        job_namespace: str = "data_lineage_app"
    ) -> Dict[str, Any]:
        
        event_time = datetime.now(timezone.utc).isoformat()
        run_id = str(uuid.uuid4())

        inputs = []
        for src in ai_result.get("sources", []):
            inputs.append(OpenLineageDataset(
                namespace=OpenLineageConverter._get_namespace(src),
                name=OpenLineageConverter._get_name(src)
            ))

        outputs = []
        for tgt in ai_result.get("targets", []):
            outputs.append(OpenLineageDataset(
                namespace=OpenLineageConverter._get_namespace(tgt),
                name=OpenLineageConverter._get_name(tgt)
            ))

        event = OpenLineageRunEvent(
            eventType="COMPLETE",
            eventTime=event_time,
            run=OpenLineageRun(runId=run_id),
            job=OpenLineageJob(namespace=job_namespace, name=job_name),
            inputs=inputs,
            outputs=outputs
        )

        return event.model_dump(by_alias=True)

