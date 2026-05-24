import { useState } from "react";
import { Shell } from "./components/Shell";
import { AgentStudio } from "./features/AgentStudio";
import { ChannelsView } from "./features/ChannelsView";
import { MessageHistory } from "./features/MessageHistory";
import { TemplateGallery } from "./features/TemplateGallery";
import { WorkflowBuilder } from "./features/WorkflowBuilder";

export type View = "templates" | "studio" | "builder" | "history" | "channels";

export function App() {
  const [view, setView] = useState<View>("templates");
  const [workflowId, setWorkflowId] = useState<string | null>(null);

  const openBuilder = (id: string) => { setWorkflowId(id); setView("builder"); };

  return (
    <Shell view={view} setView={setView}>
      {view === "templates" && <TemplateGallery onOpen={openBuilder} />}
      {view === "studio" && <AgentStudio />}
      {view === "builder" && <WorkflowBuilder workflowId={workflowId} onOpen={openBuilder} />}
      {view === "history" && <MessageHistory />}
      {view === "channels" && <ChannelsView />}
    </Shell>
  );
}
