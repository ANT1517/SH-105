"""WhatsApp-safe output for LLM-generated replies.

Two layers keep Person C's replies deliverable over WhatsApp (Twilio rejects bodies over 1,600 characters,
and WhatsApp does not render markdown headers/tables):
  1. PLAIN_TEXT_RULES is appended to every LLM system prompt (ask the model for plain text under ~1,400 chars).
  2. sanitize_reply() is a hard, deterministic safety net on whatever the model returns: strip markdown, then cut
     at a sentence boundary if it is still over MAX_REPLY_CHARS. It never returns a half-finished sentence.
"""
import re

TARGET_REPLY_CHARS = 1400   # what we ask the model to stay under (headroom for the user-facing prefixes)
MAX_REPLY_CHARS = 1500      # hard cap; Twilio's limit is 1600 and Dev-A prefixes replies ("Safety check: ")

PLAIN_TEXT_RULES = (
    "\n\nOUTPUT FORMAT RULES (these override any earlier instruction about detail or length):\n"
    "- Reply in plain text only, written as a short WhatsApp message.\n"
    "- Do NOT use markdown of any kind: no # headers, no ** or __ bold or italics, no tables or | characters, "
    "no --- lines, no backticks, no > quotes.\n"
    "- Use short paragraphs. If you need a list, use plain lines that start with '- ' or '1.'.\n"
    f"- Keep the whole reply under {TARGET_REPLY_CHARS:,} characters (about 200 words). Be concise: cover only the "
    "2 or 3 most useful points.\n"
    "- Always finish your last sentence."
)

_ABBREVIATIONS = {"rs", "inr", "e.g", "i.e", "etc", "vs", "no", "approx", "mr", "mrs", "dr", "st", "sr", "jr"}
_SENTENCE_END = re.compile(r"[.!?।]+[\"')\]]*(?=\s|$)")  # । = Devanagari danda
_TABLE_SEPARATOR = re.compile(r"^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$")
_RULE_LINE = re.compile(r"^\s*([-*_])(\s*\1){2,}\s*$")


def _table_row_to_text(line: str) -> str:
    cells = [c.strip() for c in line.strip().strip("|").split("|")]
    cells = [c for c in cells if c]
    if len(cells) == 2:
        return f"{cells[0]}: {cells[1]}"
    return " - ".join(cells)


def _strip_inline(line: str) -> str:
    line = re.sub(r"!\[([^\]]*)\]\([^)]*\)", r"\1", line)            # images -> alt text
    line = re.sub(r"\[([^\]]+)\]\(([^)]+)\)", r"\1 (\2)", line)        # [text](url) -> text (url)
    line = re.sub(r"`+([^`]*)`+", r"\1", line)                         # inline code
    line = re.sub(r"\*\*(.+?)\*\*", r"\1", line)                       # bold
    line = re.sub(r"__(.+?)__", r"\1", line)
    line = re.sub(r"~~(.+?)~~", r"\1", line)                           # strikethrough
    line = re.sub(r"(?<![\w*])\*(?![\s*])(.+?)(?<![\s*])\*(?![\w*])", r"\1", line)  # *italic*
    line = re.sub(r"(?<![\w_])_(?![\s_])(.+?)(?<![\s_])_(?![\w_])", r"\1", line)     # _italic_
    return line.replace("**", "").replace("__", "").replace("`", "")


def to_plain_text(text: str) -> str:
    """Remove markdown (headers, tables, bold/italics, code, links, quotes, rules); keep the words."""
    if not text:
        return ""
    out: list[str] = []
    for raw in text.replace("\r\n", "\n").split("\n"):
        line = raw.rstrip()
        stripped = line.strip()
        if stripped.startswith("```"):
            continue
        if _RULE_LINE.match(line):
            out.append("")
            continue
        if _TABLE_SEPARATOR.match(line) and "-" in line:
            # the row just emitted was the table header: it only labels columns, so drop it
            if out and out[-1]:
                out.pop()
            continue
        if stripped.startswith("|"):
            line = _table_row_to_text(line)
        else:
            line = re.sub(r"^\s{0,3}#{1,6}\s+", "", line)              # headers
            line = re.sub(r"\s+#+\s*$", "", line)
            line = re.sub(r"^\s*>+\s?", "", line)                      # block quotes
            line = re.sub(r"^(\s*)[*+•]\s+", r"\1- ", line)       # bullets -> "- "
        out.append(_strip_inline(line).rstrip())
    cleaned = "\n".join(out)
    cleaned = re.sub(r"[ \t]{2,}", " ", cleaned)
    cleaned = re.sub(r"\n{3,}", "\n\n", cleaned)
    return cleaned.strip()


def _is_real_sentence_end(text: str, match: re.Match) -> bool:
    """False for '.' that ends 'Rs.', 'e.g.', 'etc.' or a list number like '3.' (not a finished sentence)."""
    if text[match.start()] != ".":
        return True
    before = text[: match.start()]
    word = re.split(r"\s", before)[-1].lower().strip("([\"'")
    if word in _ABBREVIATIONS or word.rstrip(".") in _ABBREVIATIONS:
        return False
    if word.isdigit() and (len(before) == len(word) or before[-len(word) - 1] == "\n"):
        return False
    return True


def fit_to_limit(text: str, limit: int = MAX_REPLY_CHARS) -> str:
    """Return text unchanged if it fits; otherwise cut at the last complete sentence within `limit`.

    Order of preference: last sentence end, else last line break, else last word boundary + an ellipsis.
    Never cuts mid-word and never leaves a dangling half-sentence (except the last-resort ellipsis case for
    text with no sentence or line boundary at all).
    """
    if len(text) <= limit:
        return text
    window = text[:limit]
    ends = [m.end() for m in _SENTENCE_END.finditer(window) if _is_real_sentence_end(window, m)]
    if ends:
        return window[: ends[-1]].rstrip()
    newline = window.rfind("\n")
    if newline > 0:
        return window[:newline].rstrip()
    space = window.rfind(" ")
    return (window[:space] if space > 0 else window).rstrip(" ,;:-") + "…"


def sanitize_reply(text: str, limit: int = MAX_REPLY_CHARS) -> str:
    """Hard safety net applied to every LLM reply: plain text, within the WhatsApp-safe length, sentence-clean."""
    return fit_to_limit(to_plain_text(text or ""), limit)
