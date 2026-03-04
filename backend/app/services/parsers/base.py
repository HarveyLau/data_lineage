from abc import ABC, abstractmethod
from typing import Dict, Any

class BaseParser(ABC):
    @abstractmethod
    def parse(self, content: str) -> Dict[str, Any]:
        pass

