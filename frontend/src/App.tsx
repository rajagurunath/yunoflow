import { useState } from "react";
import { Shell } from "./components/Shell";
import type { PublicPage } from "./components/PublicChrome";
import { auth } from "./lib/auth";
import { AgentStudio } from "./features/AgentStudio";
import { ChannelsView } from "./features/ChannelsView";
import { Docs } from "./features/Docs";
import { Landing } from "./features/Landing";
import { Login } from "./features/Login";
import { Roadmap } from "./features/Roadmap";
import { MessageHistory } from "./features/MessageHistory";
import { Pricing } from "./features/Pricing";
import { TemplateGallery } from "./features/TemplateGallery";
import { WorkflowBuilder } from "./features/WorkflowBuilder";

export type View = "templates" | "studio" | "builder" | "history" | "channels";

function Console({ onSignOut }: { onSignOut: () => void }) {
  const [view, setView] = useState<View>("templates");
  const [workflowId, setWorkflowId] = useState<string | null>(null);
  const openBuilder = (id: string) => { setWorkflowId(id); setView("builder"); };

  return (
    <Shell view={view} setView={setView} onSignOut={onSignOut}>
      {view === "templates" && <TemplateGallery onOpen={openBuilder} />}
      {view === "studio" && <AgentStudio />}
      {view === "builder" && <WorkflowBuilder workflowId={workflowId} onOpen={openBuilder} />}
      {view === "history" && <MessageHistory />}
      {view === "channels" && <ChannelsView />}
    </Shell>
  );
}

export function App() {
  const [authed, setAuthed] = useState(auth.isAuthed());
  const [page, setPage] = useState<PublicPage | "login">("landing");

  if (authed) {
    return <Console onSignOut={() => { auth.clear(); setAuthed(false); setPage("landing"); }} />;
  }
  if (page === "login") {
    return <Login onSuccess={() => setAuthed(true)} onBack={() => setPage("landing")} />;
  }
  if (page === "pricing") {
    return <Pricing onNav={(p) => setPage(p)} onSignIn={() => setPage("login")} />;
  }
  if (page === "docs") {
    return <Docs onNav={(p) => setPage(p)} onSignIn={() => setPage("login")} />;
  }
  if (page === "roadmap") {
    return <Roadmap onNav={(p) => setPage(p)} onSignIn={() => setPage("login")} />;
  }
  return <Landing onNav={(p) => setPage(p)} onSignIn={() => setPage("login")} />;
}
