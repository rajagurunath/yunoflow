export interface Agent {
  id: string;
  name: string;
  role: string;
  system_prompt: string;
  model: string;
  temperature: number;
  top_p: number;
  tools: string[];
  channels: string[];
  schedule_cron: string | null;
  memory: { mode: string; window_size: number; summarize: boolean };
  skills: string[];
  interaction_rules: string;
  guardrails: { max_steps: number; max_tokens: number; max_cost_usd: number; allowed_tools: string[] };
  personality: { tone: string; traits: string[] };
}

export interface RFNode { id: string; type: string; data: any; position?: { x: number; y: number } }
export interface RFEdge { id: string; source: string; target: string; data?: any; label?: string | null }
export interface GraphJSON { nodes: RFNode[]; edges: RFEdge[] }

export interface Template { id: string; name: string; description: string; graph_json: GraphJSON }
export interface Workflow { id: string; name: string; description: string; graph_json: GraphJSON }
export interface Run {
  id: string; workflow_id: string; status: string;
  total_tokens: number; total_cost_usd: number; error?: string | null;
}
export interface Message {
  id: string; run_id: string; role: string; content: string;
  node_id?: string | null; channel: string; tokens: number; cost_usd: number; created_at: string;
}
export interface ToolSpec { name: string; description: string; side_effecting: boolean }
export interface WSEvent { seq: number; run_id: string; type: string; ts: string; data: any }
export interface ChannelBinding {
  id: string; channel_type: string;
  agent_id: string | null; workflow_id: string | null;
  external_chat_id: string | null; active: boolean; created_at: string;
  bot_username?: string | null; label?: string | null; has_token?: boolean;
}
