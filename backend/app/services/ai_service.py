import json
import re
from google import genai
from typing import Dict, Any, List
from app.core.config import settings

class AiService:
    def __init__(self):
        # Configure Gemini API using the new google-genai SDK
        if settings.GEMINI_API_KEY:
            self.client = genai.Client(api_key=settings.GEMINI_API_KEY)
            # Using a widely available model, though user example mentioned gemini-3
            # gemini-1.5-pro is a good stable choice for complex analysis
            self.model_name = "gemini-2.5-flash" 
        else:
            print("Warning: GEMINI_API_KEY is not set.")
            self.client = None

    def _fallback_sas_parsing(self, content: str) -> Dict[str, Any]:
        """Fallback regex parsing for SAS scripts if AI fails"""
        sources = []
        targets = []
        
        # Extract libnames to map to schemas/databases
        libnames = {}
        for match in re.finditer(r"libname\s+(\w+)\s+.*?schema=['\"](\w+)['\"]", content, re.IGNORECASE):
            libnames[match.group(1)] = match.group(2)
        
        # Sources: filename (files)
        for match in re.finditer(r"filename\s+(\w+)\s+['\"](.*?)['\"]", content, re.IGNORECASE):
            sources.append({
                "name": match.group(2).split('/')[-1],
                "type": "file",
                "path": match.group(2),
                "location": "/".join(match.group(2).split('/')[:-1])
            })
            
        # Sources: set/join tables
        # e.g. set work.table, join source_db.customers
        for match in re.finditer(r"(?:set|join)\s+([\w\.]+)", content, re.IGNORECASE):
            full_name = match.group(1)
            if "." in full_name:
                lib, table = full_name.split(".", 1)
                if lib.lower() != "work": # Ignore work tables for external lineage
                    schema = libnames.get(lib, lib)
                    sources.append({
                        "name": table,
                        "type": "table",
                        "database": schema,
                        "path": full_name
                    })
        
        # Targets: data (tables)
        # e.g. data target_dw.daily_sales_fact
        for match in re.finditer(r"data\s+([\w\.]+)", content, re.IGNORECASE):
            full_name = match.group(1)
            if "." in full_name:
                lib, table = full_name.split(".", 1)
                if lib.lower() != "work":
                    schema = libnames.get(lib, lib)
                    targets.append({
                        "name": table,
                        "type": "table",
                        "database": schema,
                        "path": full_name
                    })

        # Targets: outfile (files)
        for match in re.finditer(r"outfile=['\"](.*?)['\"]", content, re.IGNORECASE):
             targets.append({
                "name": match.group(1).split('/')[-1],
                "type": "file",
                "path": match.group(1),
                "location": "/".join(match.group(1).split('/')[:-1])
            })

        explanation_steps = self._build_local_dynamic_explanation(
            content=content,
            script_type="sas",
            sources=sources,
            targets=targets,
        )
        return {"sources": sources, "targets": targets, "explanation_steps": explanation_steps}

    def _pick_key_lines(self, content: str, max_lines: int = 4) -> List[str]:
        raw_lines = [line.strip() for line in content.splitlines() if line.strip()]
        if not raw_lines:
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
        )

        selected = []
        for line in raw_lines:
            lower_line = line.lower()
            if any(keyword in lower_line for keyword in keywords):
                selected.append(line[:180])
            if len(selected) >= max_lines:
                break

        if not selected:
            selected = [line[:180] for line in raw_lines[:max_lines]]

        return selected

    def _format_entity_names(self, entities: List[Dict[str, Any]], max_items: int = 4) -> str:
        if not entities:
            return "无"

        names = []
        for entity in entities[:max_items]:
            name = entity.get("name") or "unknown"
            entity_type = entity.get("type") or "dataset"
            system = entity.get("database") or entity.get("location") or entity.get("path")
            if system:
                names.append(f"{name}({entity_type}, {system})")
            else:
                names.append(f"{name}({entity_type})")

        remaining = len(entities) - len(names)
        if remaining > 0:
            names.append(f"以及另外 {remaining} 个实体")

        return "；".join(names)

    def _build_local_dynamic_explanation(
        self,
        content: str,
        script_type: str,
        sources: List[Dict[str, Any]],
        targets: List[Dict[str, Any]],
    ) -> List[str]:
        line_count = len(content.splitlines())
        key_lines = self._pick_key_lines(content)
        preview_block = "\n".join([f"- {line}" for line in key_lines]) if key_lines else "- 未捕获到关键文本片段"

        source_names = self._format_entity_names(sources)
        target_names = self._format_entity_names(targets)

        return [
            f"已读取 {script_type} 文件内容，共 {line_count} 行。",
            f"从导入文件中提取的关键片段：\n{preview_block}",
            f"识别到来源实体 {len(sources)} 个：{source_names}",
            f"识别到目标实体 {len(targets)} 个：{target_names}",
            "基于脚本中的读写关系，推断出数据流方向为 source -> job -> target，并转换为血缘结果。",
        ]

    def analyze_script(self, content: str, script_type: str) -> Dict[str, Any]:
        # Try AI first
        if self.client:
            try:
                prompt = f"""
                Analyze the following {script_type} script and extract the data lineage information.
                Identify all input data sources (files, database tables) and output data targets.

                Return ONLY a raw JSON object (no markdown formatting, no code blocks) with the following structure:
                {{
                    "sources": [
                        {{
                            "name": "source_name",
                            "type": "file|table",
                            "path": "full_path_or_table_name",
                            "database": "database_name_or_schema_if_applicable",
                            "location": "server_or_file_system_path"
                        }}
                    ],
                    "targets": [
                        {{
                            "name": "target_name",
                            "type": "file|table",
                            "path": "full_path_or_table_name",
                            "database": "database_name_or_schema_if_applicable",
                            "location": "server_or_file_system_path"
                        }}
                    ],
                    "explanation_steps": [
                        "Use concrete entities from this exact file, not generic wording.",
                        "Include actual source file/table names and where they come from.",
                        "Include actual target file/table names and why they are outputs.",
                        "Mention at least one concrete code or XML snippet from this file to justify the lineage."
                    ]
                }}

                Script content:
                {content}
                """
        
                response = self.client.models.generate_content(
                    model=self.model_name,
                    contents=prompt,
                )
                
                if response.text:
                    text = response.text.strip()
                    if text.startswith("```json"):
                        text = text[7:]
                    if text.startswith("```"):
                        text = text[3:]
                    if text.endswith("```"):
                        text = text[:-3]
                    result = json.loads(text.strip())
                    if not isinstance(result, dict):
                        result = {"sources": [], "targets": []}
                    # Ensure at least sources/targets keys exist
                    if "sources" not in result:
                        result["sources"] = []
                    if "targets" not in result:
                        result["targets"] = []

                    dynamic_steps = self._build_local_dynamic_explanation(
                        content=content,
                        script_type=script_type,
                        sources=result.get("sources", []),
                        targets=result.get("targets", []),
                    )

                    ai_steps = result.get("explanation_steps")
                    cleaned_ai_steps = []
                    if isinstance(ai_steps, list):
                        cleaned_ai_steps = [str(step).strip() for step in ai_steps if str(step).strip()]

                    # Always keep deterministic dynamic steps in front so UI changes by file content.
                    merged_steps = dynamic_steps + cleaned_ai_steps
                    deduped_steps = []
                    seen = set()
                    for step in merged_steps:
                        if step not in seen:
                            seen.add(step)
                            deduped_steps.append(step)
                    result["explanation_steps"] = deduped_steps[:8]
                    return result
            except Exception as e:
                print(f"Gemini Analysis failed/skipped: {e}")
                # Fallthrough to fallback
        
        # Fallback if AI fails or key missing
        if script_type == "sas" or "sas" in content.lower():
            print("Using fallback SAS parser")
            return self._fallback_sas_parsing(content)

        fallback = {"sources": [], "targets": [], "error": "AI analysis failed and no fallback for this type"}
        fallback["explanation_steps"] = self._build_local_dynamic_explanation(
            content=content,
            script_type=script_type,
            sources=[],
            targets=[],
        )
        return fallback
