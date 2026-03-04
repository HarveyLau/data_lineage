import requests
from app.core.config import settings
from typing import Dict, Any

class MarquezService:
    def __init__(self):
        self.base_url = settings.MARQUEZ_URL
        # Marquez OpenLineage endpoint
        self.lineage_endpoint = f"{self.base_url}/api/v1/lineage"

    def _check_marquez_health(self) -> bool:
        """Check if Marquez is accessible"""
        try:
            # Marquez does not expose /health by default; use a stable API endpoint instead.
            health_url = f"{self.base_url}/api/v1/namespaces"
            resp = requests.get(health_url, timeout=5)
            return resp.status_code == 200
        except Exception as e:
            return False

    def send_lineage(self, openlineage_event: Dict[str, Any]) -> bool:
        """
        Send OpenLineage event to Marquez
        Marquez expects OpenLineage events at /api/v1/lineage
        """
        try:
            # Best-effort health check; do not block sending events.
            self._check_marquez_health()

            response = requests.post(
                self.lineage_endpoint,
                json=openlineage_event,
                headers={"Content-Type": "application/json"},
                timeout=10
            )
            if response.status_code in [200, 201]:
                return True
            else:
                return False
                
        except requests.exceptions.ConnectionError as e:
            return False
        except requests.exceptions.Timeout as e:
            return False
        except Exception as e:
            return False
