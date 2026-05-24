import type { GraphJSON } from "./types";

/** Simple layered left-to-right layout for graphs that carry no positions
 * (e.g. instantiated templates). Depth = BFS distance from the start node. */
export function layoutPositions(g: GraphJSON): Record<string, { x: number; y: number }> {
  const adj: Record<string, string[]> = {};
  g.edges.forEach((e) => { (adj[e.source] ||= []).push(e.target); });

  const start = g.nodes.find((n) => n.type === "start")?.id ?? g.nodes[0]?.id;
  const depth: Record<string, number> = {};
  if (start) {
    const queue: string[] = [start];
    depth[start] = 0;
    while (queue.length) {
      const cur = queue.shift()!;
      for (const nxt of adj[cur] || []) {
        if (depth[nxt] === undefined) { depth[nxt] = depth[cur] + 1; queue.push(nxt); }
      }
    }
  }
  // any unreached nodes get pushed to the end
  let maxDepth = 0;
  for (const n of g.nodes) { if (depth[n.id] === undefined) depth[n.id] = -1; maxDepth = Math.max(maxDepth, depth[n.id]); }
  for (const n of g.nodes) if (depth[n.id] === -1) depth[n.id] = maxDepth + 1;

  const perDepth: Record<number, number> = {};
  const pos: Record<string, { x: number; y: number }> = {};
  for (const n of g.nodes) {
    const d = depth[n.id];
    const row = perDepth[d] || 0;
    perDepth[d] = row + 1;
    pos[n.id] = { x: d * 280 + 40, y: row * 150 + 40 };
  }
  return pos;
}
