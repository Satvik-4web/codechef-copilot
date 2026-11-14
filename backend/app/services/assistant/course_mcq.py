"""Small, high-confidence offline rules for course questions with explicit labels."""

import re
from typing import Optional


def solve_project_type(question: str, options: list[str], context: str = "") -> Optional[int]:
    source = "\n".join((question or "", context or ""))
    match = re.search(r"which projects? (?:are|is) (classification|regression)", source, re.I)
    if not match:
        return None
    wanted = match.group(1).lower()
    projects = {}
    for letter, description in re.findall(r"^\s*(?:[•*-]\s*)?Project\s+([A-Z])\s*:\s*(.+)$", source, re.I | re.M):
        desc = description.lower()
        categorical = bool(re.search(r"\bwhether\b|\byes\s*(?:or|/)\s*no\b|\bor\s+not\b|\bfraud\b|\bspam\b|\bpass\s*(?:or|/)\s*fail\b", desc))
        numeric = bool(re.search(r"\b(amount|weight|price|temperature|score)\b|\b(in\s+(?:mm|kg|cm|meters?|rupees?|dollars?))\b", desc))
        if categorical == numeric:
            return None
        projects[letter.upper()] = "classification" if categorical else "regression"
    if len(projects) < 2:
        return None

    expected = {letter for letter, kind in projects.items() if kind == wanted}
    for index, option in enumerate(options):
        normalized = option.strip().lower()
        if re.fullmatch(r"all projects", normalized):
            selected = set(projects)
        elif re.fullmatch(r"(?:project\s+)?[a-z](?:\s*(?:,|and|&)\s*(?:project\s+)?[a-z])*\s*(?:only)?", normalized):
            without_words = re.sub(r"\b(?:project|only)\b", "", normalized).strip()
            selected = {letter.upper() for letter in re.split(r"\s*(?:,|\band\b|&)\s*", without_words)}
        else:
            continue
        if selected == expected:
            return index
    return None
