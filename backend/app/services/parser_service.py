from typing import Dict, Any
from .parsers.controlm import ControlMParser
from .parsers.script import ScriptParser

class ParserService:
    @staticmethod
    def parse_file(filename: str, content: str) -> Dict[str, Any]:
        if filename.endswith(".xml"):
            return ControlMParser().parse(content)
        elif filename.endswith(".sh"):
            return ScriptParser("shell").parse(content)
        elif filename.endswith(".py"):
            return ScriptParser("python").parse(content)
        elif filename.endswith(".sas"):
            return ScriptParser("sas").parse(content)
        else:
            return ScriptParser("unknown").parse(content)

