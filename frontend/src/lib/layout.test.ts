import { describe, expect, it } from "vitest";
import { layoutPositions } from "./layout";
import type { GraphJSON } from "./types";

const linear: GraphJSON = {
  nodes: [
    { id: "s", type: "start", data: {} },
    { id: "a", type: "agent", data: {} },
    { id: "b", type: "agent", data: {} },
    { id: "e", type: "end", data: {} },
  ],
  edges: [
    { id: "1", source: "s", target: "a" },
    { id: "2", source: "a", target: "b" },
    { id: "3", source: "b", target: "e" },
  ],
};

describe("layoutPositions", () => {
  it("places nodes left-to-right by depth from start", () => {
    const pos = layoutPositions(linear);
    expect(pos.s.x).toBeLessThan(pos.a.x);
    expect(pos.a.x).toBeLessThan(pos.b.x);
    expect(pos.b.x).toBeLessThan(pos.e.x);
  });

  it("assigns a position to every node", () => {
    const pos = layoutPositions(linear);
    for (const n of linear.nodes) expect(pos[n.id]).toBeDefined();
  });

  it("handles a cycle (back-edge) without looping forever", () => {
    const cyclic: GraphJSON = {
      nodes: [
        { id: "s", type: "start", data: {} },
        { id: "w", type: "agent", data: {} },
        { id: "c", type: "condition", data: {} },
        { id: "e", type: "end", data: {} },
      ],
      edges: [
        { id: "1", source: "s", target: "w" },
        { id: "2", source: "w", target: "c" },
        { id: "3", source: "c", target: "w" }, // feedback loop
        { id: "4", source: "c", target: "e" },
      ],
    };
    const pos = layoutPositions(cyclic);
    expect(Object.keys(pos)).toHaveLength(4);
  });

  it("handles an empty graph", () => {
    expect(layoutPositions({ nodes: [], edges: [] })).toEqual({});
  });
});
