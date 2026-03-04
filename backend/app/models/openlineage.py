from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime
import uuid

class OpenLineageFacet(BaseModel):
    producer: str = Field(default="https://github.com/OpenLineage/OpenLineage/blob/main/spec/OpenLineage.json", alias="_producer")
    schemaURL: str = Field(default="https://github.com/OpenLineage/OpenLineage/blob/main/spec/OpenLineage.json", alias="_schemaURL")

class OpenLineageDataset(BaseModel):
    namespace: str
    name: str
    facets: Optional[Dict[str, Any]] = {}

class OpenLineageJob(BaseModel):
    namespace: str
    name: str
    facets: Optional[Dict[str, Any]] = {}

class OpenLineageRun(BaseModel):
    runId: str
    facets: Optional[Dict[str, Any]] = {}

class OpenLineageRunEvent(BaseModel):
    eventType: str # START, RUNNING, COMPLETE, FAIL
    eventTime: datetime
    run: OpenLineageRun
    job: OpenLineageJob
    inputs: Optional[List[OpenLineageDataset]] = []
    outputs: Optional[List[OpenLineageDataset]] = []
    producer: str = "https://github.com/ai-data-lineage/producer"
    schemaURL: str = "https://openlineage.io/spec/1-0-5/OpenLineage.json"
