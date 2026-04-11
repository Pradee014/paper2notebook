"""Input sanitization for user-supplied text before LLM ingestion.

Defends against prompt injection by cleaning control characters,
normalizing whitespace, and truncating to a safe length.
"""

import re

MAX_TEXT_LENGTH = 100_000  # 100K characters — enough for any paper

# Control characters to strip (preserve \t, \n, \r)
_CONTROL_CHARS = re.compile(
    r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]"
)

# Unicode special characters used for text manipulation attacks
_UNICODE_CONTROL = re.compile(
    r"[\u200b\u200c\u200d\u200e\u200f"    # zero-width chars, direction marks
    r"\u202a-\u202e"                        # bidi embedding/override
    r"\u2060-\u2064"                        # invisible operators
    r"\ufeff"                               # BOM / zero-width no-break space
    r"\ufff9-\ufffb]"                       # interlinear annotation
)

# Collapse 3+ consecutive newlines to 2
_EXCESSIVE_NEWLINES = re.compile(r"\n{3,}")


def sanitize_text(text: str) -> str:
    """Sanitize extracted paper text for safe LLM prompt inclusion.

    - Strips null bytes and ASCII/Unicode control characters
    - Preserves newlines, tabs, and carriage returns
    - Collapses excessive blank lines
    - Truncates to MAX_TEXT_LENGTH
    - Strips leading/trailing whitespace
    """
    # Strip ASCII control characters (keep \t \n \r)
    text = _CONTROL_CHARS.sub("", text)

    # Strip Unicode control/invisible characters
    text = _UNICODE_CONTROL.sub("", text)

    # Normalize \r\n to \n
    text = text.replace("\r\n", "\n").replace("\r", "\n")

    # Collapse excessive blank lines
    text = _EXCESSIVE_NEWLINES.sub("\n\n", text)

    # Strip leading/trailing whitespace
    text = text.strip()

    # Truncate to maximum length
    if len(text) > MAX_TEXT_LENGTH:
        text = text[:MAX_TEXT_LENGTH]

    return text
