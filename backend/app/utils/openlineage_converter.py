from typing import Dict, Any, List, Optional
from datetime import datetime
import uuid
from app.models.openlineage import OpenLineageRunEvent, OpenLineageRun, OpenLineageJob, OpenLineageDataset

class OpenLineageConverter:
    @staticmethod
    def _dataset_from_item(item: Dict[str, Any], default_namespace: str) -> OpenLineageDataset:
        ns = item.get("namespace") or item.get("database") or item.get("location") or default_namespace
        dataset_name = item.get("name") or item.get("path") or "unknown"
        facets = {}
        if item.get("path"):
            facets["dataSource"] = {
                "_producer": "https://github.com/OpenLineage/OpenLineage/blob/main/spec/OpenLineage.json",
                "_schemaURL": "https://openlineage.io/spec/1-0-5/OpenLineage.json#/$defs/DataSourceDatasetFacet",
                "name": dataset_name,
                "uri": item.get("path")
            }
        return OpenLineageDataset(
            namespace=ns,
            name=dataset_name,
            facets=facets if facets else None
        )

    @staticmethod
    def _build_datasets(items: List[Dict[str, Any]], default_namespace: str) -> List[OpenLineageDataset]:
        datasets = []
        for item in items:
            datasets.append(OpenLineageConverter._dataset_from_item(item, default_namespace))
        return datasets

    @staticmethod
    def build_run_event(
        event_type: str,
        job_name: str,
        run_id: str,
        event_time: datetime,
        inputs: Optional[List[OpenLineageDataset]] = None,
        outputs: Optional[List[OpenLineageDataset]] = None,
        namespace: str = "default",
        job_facets: Optional[Dict[str, Any]] = None,
        run_facets: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        event = OpenLineageRunEvent(
            eventType=event_type,
            eventTime=event_time,
            run=OpenLineageRun(runId=run_id, facets=run_facets or None),
            job=OpenLineageJob(namespace=namespace, name=job_name, facets=job_facets or None),
            inputs=inputs if inputs else None,
            outputs=outputs if outputs else None
        )
        return event.model_dump(mode='json', exclude_none=True)

    @staticmethod
    def to_openlineage_events(
        job_name: str,
        ai_result: Dict[str, Any],
        namespace: str = "default",
        run_id: Optional[str] = None,
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None,
        job_facets: Optional[Dict[str, Any]] = None,
        run_facets: Optional[Dict[str, Any]] = None,
        extra_inputs: Optional[List[Dict[str, Any]]] = None,
        extra_outputs: Optional[List[Dict[str, Any]]] = None
    ) -> list[Dict[str, Any]]:
        run_id = run_id or str(uuid.uuid4())
        start_time = start_time or datetime.utcnow()
        end_time = end_time or datetime.utcnow()

        inputs = OpenLineageConverter._build_datasets(ai_result.get("sources", []), namespace)
        outputs = OpenLineageConverter._build_datasets(ai_result.get("targets", []), namespace)

        if extra_inputs:
            inputs.extend(OpenLineageConverter._build_datasets(extra_inputs, namespace))
        if extra_outputs:
            outputs.extend(OpenLineageConverter._build_datasets(extra_outputs, namespace))

        events = [
            OpenLineageConverter.build_run_event(
                event_type="START",
                job_name=job_name,
                run_id=run_id,
                event_time=start_time,
                inputs=inputs,
                outputs=outputs,
                namespace=namespace,
                job_facets=job_facets,
                run_facets=run_facets
            ),
            OpenLineageConverter.build_run_event(
                event_type="COMPLETE",
                job_name=job_name,
                run_id=run_id,
                event_time=end_time,
                inputs=inputs,
                outputs=outputs,
                namespace=namespace,
                job_facets=job_facets,
                run_facets=run_facets
            ),
        ]

        return events

