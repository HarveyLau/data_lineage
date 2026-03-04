import xml.etree.ElementTree as ET
from .base import BaseParser
from typing import Dict, Any, List

class ControlMParser(BaseParser):
    def parse(self, content: str) -> Dict[str, Any]:
        try:
            root = ET.fromstring(content)
            jobs = []
            remote_resources = []
            database_connections = []
            
            for job in root.findall(".//JOB"):
                nodeid = job.get("NODEID") or job.findtext("NODEID") or job.findtext("NODE")
                job_data = {
                    "jobname": job.get("JOBNAME") or job.findtext("JOBNAME"),
                    "cmdline": job.get("CMDLINE") or job.findtext("CMDLINE"),
                    "nodeid": nodeid,  # Server host (VM)
                    "memname": job.get("MEMNAME") or job.findtext("MEMNAME"),
                    "description": job.findtext("DESCRIPTION", ""),
                }
                
                # Extract VARIABLE elements for file paths and DB connections
                variables = {}
                for var in job.findall(".//VARIABLE"):
                    var_name = var.findtext("NAME", "")
                    var_value = var.findtext("VALUE", "")
                    var_desc = var.findtext("DESCRIPTION", "")
                    variables[var_name] = {
                        "value": var_value,
                        "description": var_desc
                    }
                
                job_data["variables"] = variables
                
                # Identify remote file resources
                node_id = job_data.get("nodeid")
                if node_id:
                    # Check for file path variables
                    if "INPUT_FILE" in variables:
                        remote_resources.append({
                            "type": "file",
                            "host": node_id,
                            "path": variables["INPUT_FILE"]["value"],
                            "description": variables["INPUT_FILE"].get("description", ""),
                            "job": job_data["jobname"]
                        })
                    if "OUTPUT_FILE" in variables:
                        remote_resources.append({
                            "type": "file",
                            "host": node_id,
                            "path": variables["OUTPUT_FILE"]["value"],
                            "description": variables["OUTPUT_FILE"].get("description", ""),
                            "job": job_data["jobname"],
                            "direction": "output"
                        })
                
                # Identify database connections
                db_vars = ["DB_HOST", "DB_PORT", "DB_NAME", "DB_SCHEMA", "DB_TABLE"]
                if all(var in variables for var in ["DB_HOST", "DB_NAME"]):
                    db_conn = {
                        "type": "database",
                        "host": variables["DB_HOST"]["value"],
                        "port": int(variables.get("DB_PORT", {}).get("value", 5432)),
                        "database": variables["DB_NAME"]["value"],
                        "schema": variables.get("DB_SCHEMA", {}).get("value", "public"),
                        "table": variables.get("DB_TABLE", {}).get("value", ""),
                        "job": job_data["jobname"]
                    }
                    database_connections.append(db_conn)
                
                jobs.append(job_data)
            
            return {
                "type": "control-m",
                "jobs": jobs,
                "remote_resources": remote_resources,
                "database_connections": database_connections,
                "requires_credentials": len(remote_resources) > 0 or len(database_connections) > 0
            }
        except Exception as e:
            return {"type": "error", "message": str(e)}
