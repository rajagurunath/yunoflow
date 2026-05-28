"""ReactFlow graph schema (Compiler input) + validation result types.

The ReactFlow document IS the workflow definition. node.data is type-specific:
  start     -> {}
  end       -> {}
  agent     -> {"agent_id": "<uuid>"}
  tool      -> {"tools": ["http_get", ...]}            (P3 registry)
  condition -> {"mode": "llm"|"value"|"expr",
                "branches": [{"label": "refund", "when"?: "..."}, ...],
                "default"?: "info", "prompt"?: "...", "key"?: "...", "expr"?: "..."}
  human     -> {"prompt"?: "..."}   pauses the run (interrupt) until a human
               replies — over Telegram or the console resume endpoint
  deepagent -> {"agent_id": "<uuid>"}                  (P5)
  a2a_remote-> {"card_url": "http://..."}              (P5)

An edge is conditional iff its source node is a `condition`. Its label is read
from data.when (falling back to edge.label) and must match a declared branch.
A back-edge (target earlier in the graph) is a cycle — supported natively.
"""
from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

NodeType = Literal["start", "end", "agent", "tool", "condition", "human", "deepagent", "a2a_remote"]


class RFNode(BaseModel):
    id: str
    type: NodeType
    data: dict = Field(default_factory=dict)
    position: dict = Field(default_factory=dict)  # UI-only; Compiler ignores


class RFEdge(BaseModel):
    id: str
    source: str
    target: str
    data: dict = Field(default_factory=dict)
    label: str | None = None


class GraphJSON(BaseModel):
    nodes: list[RFNode] = Field(default_factory=list)
    edges: list[RFEdge] = Field(default_factory=list)


class ValidationIssue(BaseModel):
    message: str
    node_id: str | None = None
    edge_id: str | None = None
    level: Literal["error", "warning"] = "error"


class ValidationResult(BaseModel):
    ok: bool
    errors: list[ValidationIssue] = Field(default_factory=list)
    warnings: list[ValidationIssue] = Field(default_factory=list)
