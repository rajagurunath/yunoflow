"""Built-in real tools."""
from __future__ import annotations

import ast
import datetime as dt
import operator
from pathlib import Path

import httpx

from app.tools.registry import register

KB_DIR = Path(__file__).resolve().parent.parent / "templates" / "kb"

_OPS = {
    ast.Add: operator.add, ast.Sub: operator.sub, ast.Mult: operator.mul,
    ast.Div: operator.truediv, ast.Pow: operator.pow, ast.Mod: operator.mod,
    ast.USub: operator.neg, ast.UAdd: operator.pos,
}


def _eval_arith(node):
    if isinstance(node, ast.Constant) and isinstance(node.value, (int, float)):
        return node.value
    if isinstance(node, ast.BinOp) and type(node.op) in _OPS:
        return _OPS[type(node.op)](_eval_arith(node.left), _eval_arith(node.right))
    if isinstance(node, ast.UnaryOp) and type(node.op) in _OPS:
        return _OPS[type(node.op)](_eval_arith(node.operand))
    raise ValueError("unsupported expression")


@register("http_get", side_effecting=True)
async def http_get(url: str) -> str:
    """Fetch a URL with an HTTP GET and return the first 2000 characters of the body."""
    async with httpx.AsyncClient(timeout=10, follow_redirects=True) as client:
        resp = await client.get(url)
        return resp.text[:2000]


@register("web_search", side_effecting=True)
def web_search(query: str, k: int = 5) -> str:
    """Search the web and return up to k result snippets."""
    try:
        from ddgs import DDGS
    except ImportError:
        return "web_search unavailable (install the 'search' extra: ddgs)"
    with DDGS() as ddgs:
        results = list(ddgs.text(query, max_results=k))
    return "\n".join(f"- {r.get('title')}: {r.get('body', '')[:160]}" for r in results) or "no results"


@register("calculator")
def calculator(expression: str) -> str:
    """Evaluate a basic arithmetic expression, e.g. '2*(3+4)'."""
    try:
        return str(_eval_arith(ast.parse(expression, mode="eval").body))
    except Exception as exc:  # noqa: BLE001
        return f"error: {exc}"


@register("current_datetime")
def current_datetime(tz: str = "UTC") -> str:
    """Return the current UTC datetime in ISO 8601 format."""
    return dt.datetime.now(dt.timezone.utc).isoformat()


@register("read_kb")
def read_kb(query: str) -> str:
    """Search the local knowledge-base markdown files for lines relevant to the query."""
    if not KB_DIR.exists():
        return "knowledge base is empty"
    terms = [t for t in query.lower().split() if len(t) > 2]
    hits: list[str] = []
    for md in sorted(KB_DIR.glob("*.md")):
        for line in md.read_text(encoding="utf-8").splitlines():
            low = line.lower()
            if line.strip() and any(t in low for t in terms):
                hits.append(line.strip())
    return "\n".join(hits[:8]) or "no relevant knowledge-base entries"
