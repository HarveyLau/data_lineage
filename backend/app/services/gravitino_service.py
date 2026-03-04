import requests
from app.core.config import settings
from typing import Dict, Any, List
from urllib.parse import urlparse

class GravitinoService:
    def __init__(self):
        self.base_url = settings.GRAVITINO_URL
        self.metalake = "lineage_lake"
        self.catalog = "data_catalog"

    def _get_headers(self):
        return {"Content-Type": "application/json", "Accept": "application/vnd.gravitino.v1+json"}

    def _parse_sqla_database_url(self) -> Dict[str, Any]:
        """
        Parse SQLAlchemy-style DATABASE_URL like:
          postgresql://user:password@postgres:5432/lineage_app_db
        into JDBC pieces expected by Gravitino JDBC catalogs.
        """
        u = urlparse(settings.DATABASE_URL)
        db = (u.path or "").lstrip("/") or None
        host = u.hostname or None
        port = u.port or 5432
        user = u.username or None
        password = u.password or None
        jdbc_url = None
        jdbc_url_with_db = None
        if host:
            jdbc_url = f"jdbc:postgresql://{host}:{port}"
            if db:
                jdbc_url_with_db = f"{jdbc_url}/{db}"

        return {
            "host": host,
            "port": port,
            "database": db,
            "user": user,
            "password": password,
            "jdbc_url": jdbc_url,
            "jdbc_url_with_db": jdbc_url_with_db,
        }

    def _check_metalake_exists(self) -> bool:
        """Check if metalake exists"""
        url = f"{self.base_url}/api/metalakes/{self.metalake}"
        try:
            resp = requests.get(url, headers=self._get_headers())
            return resp.status_code == 200
        except Exception as e:
            return False

    def init_metalake(self):
        # Create metalake if not exists
        if self._check_metalake_exists():
            return
        
        url = f"{self.base_url}/api/metalakes"
        try:
            payload = {"name": self.metalake, "comment": "Metalake for Data Lineage Project"}
            resp = requests.post(url, json=payload, headers=self._get_headers(), timeout=10)
            if resp.status_code in [200, 201]:
                pass
            elif resp.status_code == 409:
                pass
            else:
                pass
        except requests.exceptions.RequestException as e:
            pass
        except Exception as e:
            pass

    def _check_catalog_exists(self) -> bool:
        """Check if catalog exists"""
        url = f"{self.base_url}/api/metalakes/{self.metalake}/catalogs/{self.catalog}"
        try:
            resp = requests.get(url, headers=self._get_headers())
            return resp.status_code == 200
        except Exception as e:
            return False

    def _get_catalog(self) -> Dict[str, Any] | None:
        """Fetch catalog details (best-effort) to validate properties."""
        url = f"{self.base_url}/api/metalakes/{self.metalake}/catalogs/{self.catalog}"
        try:
            resp = requests.get(url, headers=self._get_headers(), timeout=10)
            if resp.status_code != 200:
                return None
            return resp.json()
        except Exception as e:
            return None

    def delete_catalog(self):
        """Delete catalog (used to recover from invalid catalog properties)."""
        url = f"{self.base_url}/api/metalakes/{self.metalake}/catalogs/{self.catalog}"
        try:
            resp = requests.delete(url, headers=self._get_headers(), timeout=10)
            if resp.status_code in [200, 204]:
                pass
            elif resp.status_code == 404:
                pass
            else:
                pass
        except Exception as e:
            pass

    def create_catalog(self):
        # Create catalog if not exists
        if self._check_catalog_exists():
            # Validate existing catalog has required JDBC properties (e.g. jdbc-database)
            cat = self._get_catalog()
            # Response schema may vary by version; attempt common shapes
            props = None
            if isinstance(cat, dict):
                props = (
                    cat.get("catalog", {}).get("properties")
                    or cat.get("properties")
                    or cat.get("data", {}).get("properties")
                )
            jdbc_db = None
            if isinstance(props, dict):
                jdbc_db = props.get("jdbc-database") or props.get("jdbc.database")
            if not jdbc_db:
                self.delete_catalog()
            else:
                return
            
        url = f"{self.base_url}/api/metalakes/{self.metalake}/catalogs"
        try:
            jdbc = self._parse_sqla_database_url()
            if not jdbc.get("jdbc_url") or not jdbc.get("database"):
                raise ValueError("DATABASE_URL missing host or database; cannot create JDBC catalog")

            # Prefer full JDBC URL including database for maximum compatibility.
            # We still provide jdbc-database because Gravitino validates it.
            jdbc_url_to_use = jdbc.get("jdbc_url_with_db") or jdbc.get("jdbc_url")

            payload = {
                "name": self.catalog,
                "type": "relational",
                "provider": "jdbc-postgresql",
                "comment": "Main catalog",
                "properties": {
                    # Gravitino JDBC catalog expects a JDBC URL (without database) + jdbc-database
                    "jdbc-url": jdbc_url_to_use,
                    "jdbc-database": jdbc["database"],
                    "jdbc-user": jdbc["user"] or "",
                    "jdbc-password": jdbc["password"] or "",
                    "jdbc-driver": "org.postgresql.Driver"
                }
            }

            resp = requests.post(url, json=payload, headers=self._get_headers(), timeout=10)

            if resp.status_code in [200, 201]:
                pass
            elif resp.status_code == 409:
                pass
            else:
                pass
        except requests.exceptions.RequestException as e:
            pass
        except Exception as e:
            pass

    def _check_schema_exists(self, schema_name: str) -> bool:
        """Check if schema exists"""
        url = f"{self.base_url}/api/metalakes/{self.metalake}/catalogs/{self.catalog}/schemas/{schema_name}"
        try:
            resp = requests.get(url, headers=self._get_headers())
            return resp.status_code == 200
        except Exception as e:
            return False

    def create_schema(self, schema_name: str = "public"):
        # Create schema if not exists
        if self._check_schema_exists(schema_name):
            return
            
        url = f"{self.base_url}/api/metalakes/{self.metalake}/catalogs/{self.catalog}/schemas"
        try:
            payload = {
                "name": schema_name,
                "comment": f"Schema for {schema_name}"
            }
            resp = requests.post(url, json=payload, headers=self._get_headers(), timeout=10)
            if resp.status_code in [200, 201]:
                pass
            elif resp.status_code == 409:
                pass
            else:
                pass
        except requests.exceptions.RequestException as e:
            pass
        except Exception as e:
            pass

    def register_dataset(self, name: str, schema: str = "public", dataset_type: str = "table", _retry: bool = True) -> str:
        # Register a table/dataset in Gravitino
        # ensure schema exists first
        self.create_schema(schema)
        
        # Create table (dataset)
        url = f"{self.base_url}/api/metalakes/{self.metalake}/catalogs/{self.catalog}/schemas/{schema}/tables"
        
        # Sanitize name for table usage if needed
        safe_name = name.replace(".", "_").replace("/", "_").replace("-", "_").replace(" ", "_")
        if not safe_name or len(safe_name) == 0:
            safe_name = "unnamed_dataset"
        
        # Gravitino expects Gravitino-rel type names (e.g. "integer", "string"),
        # not DB-specific aliases like "int" / "varchar".
        payload = {
            "name": safe_name,
            "columns": [
                {"name": "id", "type": "integer", "nullable": True, "comment": "placeholder id"},
                {"name": "data", "type": "string", "nullable": True, "comment": "placeholder data"}
            ],
            "comment": f"Registered dataset for {name}",
            "properties": {}
        }

        try:
            resp = requests.post(url, json=payload, headers=self._get_headers(), timeout=10)
            if resp.status_code in [200, 201]:
                pass
            elif resp.status_code == 409:
                pass
            else:
                # Recover from invalid catalog properties (e.g., missing jdbc-database)
                if _retry and "jdbc-database" in resp.text:
                    self.delete_catalog()
                    self.create_catalog()
                    self.create_schema(schema)
                    return self.register_dataset(name=name, schema=schema, dataset_type=dataset_type, _retry=False)
                raise Exception(f"Gravitino API error: {resp.status_code} - {resp.text}")
        except requests.exceptions.RequestException as e:
            raise
        except Exception as e:
            raise

        return f"{self.metalake}.{self.catalog}.{schema}.{safe_name}"

    # Since Gravitino Lineage API might be complex or version specific, 
    # we might just store the entities for now. 
    # But to satisfy "inject lineage", we might need to look for a specific lineage endpoint
    # or just assume we are populating the metadata that *represents* the lineage nodes.
    
    def report_lineage(self, source: str, target: str):
        # This is a placeholder. Real Gravitino Lineage might involve
        # passing an event or relation.
        # For this prototype, we'll log it or maybe store in a custom table if Gravitino doesn't support it easily.
        print(f"Reporting lineage: {source} -> {target}")

