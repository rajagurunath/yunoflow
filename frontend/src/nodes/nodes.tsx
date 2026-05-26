import { Handle, Position } from "@xyflow/react";

type NodeData = {
  label: string;
  sub?: string;
  status?: "idle" | "running" | "done";
  branches?: string[];
};

const STATUS_RING: Record<string, string> = {
  idle: "border-line2",
  running: "running-glow",
  done: "border-mint/40",
};

function Frame({ data, accent, glyph, inPort = true, outPort = true }: {
  data: NodeData; accent: string; glyph: string; inPort?: boolean; outPort?: boolean;
}) {
  const status = data.status || "idle";
  return (
    <div className={`w-48 rounded-xl border bg-gradient-to-b from-bg3 to-bg2 shadow-xl ${STATUS_RING[status]}`}>
      {inPort && <Handle type="target" position={Position.Left} className="!h-2.5 !w-2.5 !bg-bg4 !border-2 !border-line2" />}
      <div className="flex items-center gap-2.5 px-3 pt-2.5 pb-2">
        <div className="grid h-7 w-7 place-items-center rounded-lg font-disp text-sm" style={{ background: `${accent}22`, color: accent }}>
          {glyph}
        </div>
        <div className="min-w-0">
          <div className="truncate font-disp text-[13px] font-semibold leading-tight">{data.label}</div>
          {data.sub && <div className="truncate font-mono text-[10px] text-t2">{data.sub}</div>}
        </div>
      </div>
      {data.branches && (
        <div className="flex gap-1.5 px-3 pb-2.5">
          {data.branches.map((b) => (
            <span key={b} className="flex-1 rounded-md border border-dashed border-line2 py-1 text-center font-mono text-[10px] text-t1">{b}</span>
          ))}
        </div>
      )}
      {outPort && <Handle type="source" position={Position.Right} className="!h-2.5 !w-2.5 !bg-bg4 !border-2 !border-line2" />}
    </div>
  );
}

export const AgentNode = ({ data }: { data: NodeData }) => <Frame data={data} accent="#12876a" glyph="◎" />;
export const ConditionNode = ({ data }: { data: NodeData }) => <Frame data={data} accent="#b78a2e" glyph="⟁" />;
export const ToolNode = ({ data }: { data: NodeData }) => <Frame data={data} accent="#1486a8" glyph="⚒" />;
export const DeepAgentNode = ({ data }: { data: NodeData }) => <Frame data={data} accent="#0d6e54" glyph="❖" />;

export const StartNode = ({ data }: { data: NodeData }) => (
  <div className="rounded-full border border-mint/40 bg-bg2 px-4 py-2 font-mono text-[11px] text-mint">
    <Handle type="source" position={Position.Right} className="!h-2.5 !w-2.5 !bg-mint !border-0" />
    ▶ {data.label || "start"}
  </div>
);
export const EndNode = ({ data }: { data: NodeData }) => (
  <div className="rounded-full border border-line2 bg-bg2 px-4 py-2 font-mono text-[11px] text-t1">
    <Handle type="target" position={Position.Left} className="!h-2.5 !w-2.5 !bg-bg4 !border-2 !border-line2" />
    ■ {data.label || "end"}
  </div>
);

export const nodeTypes = {
  agent: AgentNode,
  condition: ConditionNode,
  tool: ToolNode,
  deepagent: DeepAgentNode,
  a2a_remote: DeepAgentNode,
  start: StartNode,
  end: EndNode,
};
