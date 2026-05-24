"""The Compiler — turns a ReactFlow graph_json into an executable LangGraph.

Mapping: node -> graph node; edge -> edge; edge out of a `condition` node ->
add_conditional_edges keyed on state['route']; back-edge -> cycle (native).
"""
from __future__ import annotations

from langgraph.graph import END, START, StateGraph

from app.core.errors import CompileError
from app.runtime.nodes.agent_node import make_agent_node
from app.runtime.nodes.condition_node import make_condition_node
from app.runtime.nodes.tool_node import make_tool_node
from app.runtime.state import AgentState
from app.schemas.graph import GraphJSON, ValidationIssue, ValidationResult


def _no_tools(_names):
    return []


def validate(graph: GraphJSON, agents: dict, known_tools: set | None = None) -> ValidationResult:
    errors: list[ValidationIssue] = []
    warnings: list[ValidationIssue] = []
    nodes_by_id = {n.id: n for n in graph.nodes}

    starts = [n for n in graph.nodes if n.type == "start"]
    ends = [n for n in graph.nodes if n.type == "end"]
    if len(starts) != 1:
        errors.append(ValidationIssue(message=f"exactly one start node required (found {len(starts)})"))
    if not ends:
        errors.append(ValidationIssue(message="at least one end node required"))

    for e in graph.edges:
        if e.source not in nodes_by_id:
            errors.append(ValidationIssue(message=f"edge source '{e.source}' not found", edge_id=e.id))
        if e.target not in nodes_by_id:
            errors.append(ValidationIssue(message=f"edge target '{e.target}' not found", edge_id=e.id))

    for n in graph.nodes:
        if n.type in ("agent", "deepagent"):
            aid = n.data.get("agent_id")
            if not aid:
                errors.append(ValidationIssue(message="agent node missing agent_id", node_id=n.id))
            elif aid not in agents:
                errors.append(ValidationIssue(message=f"agent_id {aid} not found", node_id=n.id))
        if n.type == "tool" and known_tools is not None:
            for t in n.data.get("tools", []) or []:
                if t not in known_tools:
                    errors.append(ValidationIssue(message=f"unknown tool '{t}'", node_id=n.id))

    edges_by_source: dict[str, list] = {}
    for e in graph.edges:
        edges_by_source.setdefault(e.source, []).append(e)

    for n in graph.nodes:
        if n.type != "condition":
            continue
        branches = n.data.get("branches", []) or []
        labels = [b.get("label") for b in branches]
        if len(branches) < 2:
            errors.append(ValidationIssue(message="condition needs >=2 branches", node_id=n.id))
        out = edges_by_source.get(n.id, [])
        out_labels = {(e.data.get("when") or e.label) for e in out}
        for e in out:
            lbl = e.data.get("when") or e.label
            if lbl not in labels:
                errors.append(ValidationIssue(
                    message=f"edge label '{lbl}' is not a declared branch", edge_id=e.id, node_id=n.id))
        default = n.data.get("default")
        uncovered = [l for l in labels if l not in out_labels]
        if uncovered and (default is None or default in uncovered):
            errors.append(ValidationIssue(
                message=f"branches without an outgoing edge: {uncovered}", node_id=n.id))

    # reachability (warnings only; max_steps is the runtime backstop)
    if starts:
        adj: dict[str, list[str]] = {}
        for e in graph.edges:
            adj.setdefault(e.source, []).append(e.target)
        seen: set[str] = set()
        stack = [starts[0].id]
        while stack:
            x = stack.pop()
            if x in seen:
                continue
            seen.add(x)
            stack.extend(adj.get(x, []))
        for n in graph.nodes:
            if n.type != "start" and n.id not in seen:
                warnings.append(ValidationIssue(message="node not reachable from start",
                                                node_id=n.id, level="warning"))

    return ValidationResult(ok=not errors, errors=errors, warnings=warnings)


def compile_graph(graph: GraphJSON, *, agents: dict, checkpointer,
                  llm_factory=None, tool_resolver=None, known_tools: set | None = None,
                  dry_run: bool = False):
    """Validate then (unless dry_run) build a compiled StateGraph."""
    result = validate(graph, agents, known_tools)
    if dry_run:
        return result
    if not result.ok:
        raise CompileError("; ".join(i.message for i in result.errors))

    tool_resolver = tool_resolver or _no_tools
    nodes_by_id = {n.id: n for n in graph.nodes}

    def resolve(target_id: str):
        return END if nodes_by_id[target_id].type == "end" else target_id

    builder = StateGraph(AgentState)
    for n in graph.nodes:
        if n.type in ("start", "end"):
            continue
        if n.type == "agent":
            builder.add_node(n.id, make_agent_node(agents[n.data["agent_id"]], llm_factory, tool_resolver))
        elif n.type == "condition":
            builder.add_node(n.id, make_condition_node(n.data, llm_factory))
        elif n.type == "tool":
            builder.add_node(n.id, make_tool_node(tool_resolver(n.data.get("tools", []))))
        else:
            raise CompileError(f"node type '{n.type}' is not supported until a later phase")

    edges_by_source: dict[str, list] = {}
    for e in graph.edges:
        edges_by_source.setdefault(e.source, []).append(e)

    for src, out in edges_by_source.items():
        src_node = nodes_by_id[src]
        if src_node.type == "start":
            for e in out:
                builder.add_edge(START, resolve(e.target))
        elif src_node.type == "condition":
            path_map = {(e.data.get("when") or e.label): resolve(e.target) for e in out}
            builder.add_conditional_edges(src, lambda s: s.get("route"), path_map)
        else:
            for e in out:
                builder.add_edge(src, resolve(e.target))

    return builder.compile(checkpointer=checkpointer)
