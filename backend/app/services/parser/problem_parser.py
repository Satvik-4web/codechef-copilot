import re
from typing import Dict, List, Any, Tuple
from bs4 import BeautifulSoup
from app.services.browser.codechef_selectors import (
    TITLE_SELECTORS,
    STATEMENT_SELECTORS,
    INPUT_FORMAT_HEADERS,
    OUTPUT_FORMAT_HEADERS,
    CONSTRAINTS_HEADERS,
)

class ProblemParser:
    """
    Resilient parser for CodeChef problem pages using visible DOM patterns and fallback heuristics.
    Computes a parser confidence score and extracts structured test cases.
    """

    @classmethod
    def parse(cls, html: str, url: str = "", manual_statement: str = None, manual_title: str = None) -> Dict[str, Any]:
        soup = BeautifulSoup(html, "html.parser")

        # 1. Title Extraction
        title = manual_title or cls._extract_title(soup, url)

        # 2. Main Container Extraction
        statement_container = cls._extract_statement_container(soup)
        raw_text = statement_container.get_text("\n") if statement_container else soup.get_text("\n")

        # If manual statement provided, override or merge
        if manual_statement and manual_statement.strip():
            raw_text = manual_statement.strip()

        # 3. Section Splitting
        statement, input_fmt, output_fmt, constraints = cls._split_sections(raw_text)

        # 4. Extract Examples / Sample Test Cases
        examples = cls._extract_examples(soup, raw_text)

        # 5. Compute Confidence Score
        confidence = cls._calculate_confidence(title, statement, input_fmt, output_fmt, constraints, examples)

        return {
            "title": title or "CodeChef Practice Task",
            "source_url": url,
            "statement": statement.strip(),
            "input_format": input_fmt.strip(),
            "output_format": output_fmt.strip(),
            "constraints": constraints.strip(),
            "examples": examples,
            "parser_confidence": round(confidence, 2)
        }

    @classmethod
    def _extract_title(cls, soup: BeautifulSoup, url: str) -> str:
        for selector in TITLE_SELECTORS:
            el = soup.select_one(selector)
            if el and el.get_text(strip=True):
                text = el.get_text(strip=True)
                # Ignore generic titles
                if text.lower() not in ["codechef", "compete", "practice", "home", "problems"]:
                    return text

        # Check page <title>
        title_tag = soup.find("title")
        if title_tag and title_tag.string:
            title_text = title_tag.string.strip()
            # Often "Problem Name | CodeChef"
            parts = [p.strip() for p in title_text.split("|")]
            if parts and len(parts[0]) > 0:
                return parts[0]

        # Extract code from URL (e.g. /problems/FLOW001)
        if url:
            match = re.search(r"/problems/([A-Za-z0-9_]+)", url)
            if match:
                return f"Problem {match.group(1)}"

        return "CodeChef Problem"

    @classmethod
    def _extract_statement_container(cls, soup: BeautifulSoup) -> Any:
        for sel in STATEMENT_SELECTORS:
            el = soup.select_one(sel)
            if el:
                return el
        return None

    @classmethod
    def _split_sections(cls, full_text: str) -> Tuple[str, str, str, str]:
        lines = [line.strip() for line in full_text.splitlines() if line.strip()]
        
        statement_lines = []
        input_lines = []
        output_lines = []
        constraint_lines = []

        current_section = "statement"

        for line in lines:
            lower = line.lower()
            
            # Detect section changes
            if any(h.lower() in lower for h in INPUT_FORMAT_HEADERS) and len(line) < 40:
                current_section = "input"
                continue
            elif any(h.lower() in lower for h in OUTPUT_FORMAT_HEADERS) and len(line) < 40:
                current_section = "output"
                continue
            elif any(h.lower() in lower for h in CONSTRAINTS_HEADERS) and len(line) < 40:
                current_section = "constraints"
                continue
            elif "sample" in lower and any(term in lower for term in ["input", "output", "test"]):
                # Sample block reached
                current_section = "examples"
                continue

            if current_section == "statement":
                statement_lines.append(line)
            elif current_section == "input":
                input_lines.append(line)
            elif current_section == "output":
                output_lines.append(line)
            elif current_section == "constraints":
                constraint_lines.append(line)

        statement_text = "\n".join(statement_lines) if statement_lines else full_text[:1000]
        input_text = "\n".join(input_lines) or "See problem statement for standard input specification."
        output_text = "\n".join(output_lines) or "See problem statement for standard output specification."
        constraints_text = "\n".join(constraint_lines) or "Constraints as specified in the problem statement."

        return statement_text, input_text, output_text, constraints_text

    @classmethod
    def _extract_examples(cls, soup: BeautifulSoup, raw_text: str) -> List[Dict[str, str]]:
        examples = []
        
        # 1. Search for pre tags (commonly used for sample inputs/outputs)
        pres = soup.find_all("pre")
        if len(pres) >= 2:
            # Pair them up if even number
            for i in range(0, len(pres) - 1, 2):
                stdin = pres[i].get_text().strip()
                stdout = pres[i+1].get_text().strip()
                if stdin or stdout:
                    examples.append({
                        "name": f"Sample {len(examples) + 1}",
                        "stdin": stdin,
                        "expected_stdout": stdout
                    })

        # 2. Heuristic regex search in raw_text if pre extraction gave nothing
        if not examples:
            sample_blocks = re.findall(
                r"(?:Sample\s+Input|Example\s+Input|Input\s+1)[\s\S]*?(?:Sample\s+Output|Example\s+Output|Output\s+1)[\s\S]*?(?=(?:Sample\s+Input|Explanation|$))",
                raw_text,
                re.IGNORECASE
            )
            for idx, block in enumerate(sample_blocks):
                in_match = re.search(r"(?:Sample\s+Input|Input)[\s:\d]*\n([\s\S]*?)(?:Sample\s+Output|Output)", block, re.IGNORECASE)
                out_match = re.search(r"(?:Sample\s+Output|Output)[\s:\d]*\n([\s\S]*?)$", block, re.IGNORECASE)
                
                stdin = in_match.group(1).strip() if in_match else ""
                stdout = out_match.group(1).strip() if out_match else ""
                
                if stdin or stdout:
                    examples.append({
                        "name": f"Sample {idx + 1}",
                        "stdin": stdin,
                        "expected_stdout": stdout
                    })

        # Default fallback sample test if none could be extracted
        if not examples:
            examples.append({
                "name": "Custom Test 1",
                "stdin": "",
                "expected_stdout": ""
            })

        return examples

    @classmethod
    def _calculate_confidence(
        cls,
        title: str,
        statement: str,
        input_fmt: str,
        output_fmt: str,
        constraints: str,
        examples: List[Dict[str, str]]
    ) -> float:
        score = 0.0
        if title and title != "CodeChef Problem":
            score += 0.25
        if statement and len(statement) > 40:
            score += 0.25
        if input_fmt and not input_fmt.startswith("See problem statement"):
            score += 0.15
        if output_fmt and not output_fmt.startswith("See problem statement"):
            score += 0.15
        if constraints and not constraints.startswith("Constraints as specified"):
            score += 0.10
        if examples and any(ex.get("stdin") or ex.get("expected_stdout") for ex in examples):
            score += 0.10
        return min(max(score, 0.2), 1.0)
