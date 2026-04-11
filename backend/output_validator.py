"""Output validation for LLM-generated notebook cells (Layer 3 defense).

Scans code cells for dangerous patterns that could indicate a successful
prompt injection attack where the LLM was tricked into generating
malicious code. Returns warnings (does not block) so the user can review.
"""

import re

# Each pattern: (compiled regex, human-readable name, warning message)
_DANGEROUS_PATTERNS: list[tuple[re.Pattern, str, str]] = [
    (
        re.compile(r"\bos\.system\s*\("),
        "os.system",
        "Executes arbitrary shell commands",
    ),
    (
        re.compile(r"\bos\.popen\s*\("),
        "os.popen",
        "Executes shell commands and reads output",
    ),
    (
        re.compile(r"\bos\.exec\w*\s*\("),
        "os.exec*",
        "Replaces current process with a shell command",
    ),
    (
        re.compile(r"\bos\.environ\b"),
        "os.environ",
        "Accesses environment variables (may leak secrets)",
    ),
    (
        re.compile(r"\bsubprocess\.\w+\s*\("),
        "subprocess",
        "Executes external processes",
    ),
    (
        re.compile(r"\beval\s*\("),
        "eval(",
        "Evaluates arbitrary Python expressions",
    ),
    (
        re.compile(r"\bexec\s*\("),
        "exec(",
        "Executes arbitrary Python code",
    ),
    (
        re.compile(r"\b__import__\s*\("),
        "__import__",
        "Dynamic module import (can bypass static analysis)",
    ),
    (
        re.compile(r"\bopen\s*\([^)]*['\"][wWaA]['\"]"),
        "open(write)",
        "Opens a file for writing",
    ),
    (
        re.compile(r"\brequests\.\w+\s*\("),
        "requests",
        "Makes HTTP requests (potential data exfiltration)",
    ),
    (
        re.compile(r"\burllib\.request\.\w+\s*\("),
        "urllib.request",
        "Makes HTTP requests (potential data exfiltration)",
    ),
    (
        re.compile(r"\bshutil\.\w+\s*\("),
        "shutil",
        "File/directory operations (copy, move, delete)",
    ),
    (
        re.compile(r"\bsocket\.\w+\s*\("),
        "socket",
        "Low-level network operations",
    ),
    (
        re.compile(r"\bctypes\.\w+"),
        "ctypes",
        "Foreign function interface (can call arbitrary C code)",
    ),
]


def validate_notebook_safety(cells: list[dict]) -> list[dict]:
    """Scan notebook code cells for dangerous patterns.

    Returns a list of warning dicts, each with:
    - cell_index: int — which cell contains the pattern
    - pattern: str — the pattern name that matched
    - message: str — human-readable explanation

    Only scans code cells; markdown cells are skipped.
    """
    warnings = []

    for i, cell in enumerate(cells):
        if cell.get("cell_type") != "code":
            continue

        source = cell.get("source", "")

        for regex, pattern_name, message in _DANGEROUS_PATTERNS:
            if regex.search(source):
                warnings.append({
                    "cell_index": i,
                    "pattern": pattern_name,
                    "message": message,
                })

    return warnings
