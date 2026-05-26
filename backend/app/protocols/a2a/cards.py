"""A2A Agent Card construction (discovery layer).

Exposes each agent as an A2A-discoverable Agent Card following the public A2A
schema (https://a2a-protocol.org). This makes YunoFlow agents addressable by
other A2A-speaking systems. Full JSON-RPC task execution over A2A is a
documented future direction (the a2a-sdk 1.x runtime is Protobuf-backed).
"""
from __future__ import annotations

A2A_PROTOCOL_VERSION = "0.3.0"


def build_agent_card(agent, base_url: str) -> dict:
    base = base_url.rstrip("/")
    skills = agent.skills or ["general"]
    return {
        "protocolVersion": A2A_PROTOCOL_VERSION,
        "name": agent.name,
        "description": agent.role or f"Agent {agent.name}",
        "url": f"{base}/api/a2a/agents/{agent.id}",
        "preferredTransport": "JSONRPC",
        "version": "1.0.0",
        "capabilities": {"streaming": False, "pushNotifications": False, "stateTransitionHistory": True},
        "defaultInputModes": ["text/plain"],
        "defaultOutputModes": ["text/plain"],
        "skills": [
            {
                "id": str(skill).lower().replace(" ", "_"),
                "name": str(skill),
                "description": f"{agent.name}: {skill}",
                "tags": list(agent.tools or []),
            }
            for skill in skills
        ],
    }
