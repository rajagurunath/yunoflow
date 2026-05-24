import React from "react";

export function Panel({ className = "", children, style }: {
  className?: string; children: React.ReactNode; style?: React.CSSProperties;
}) {
  return (
    <div style={style} className={`rounded-2xl border border-line bg-bg2/70 backdrop-blur-md ${className}`}>
      {children}
    </div>
  );
}

export function Button({ children, onClick, variant = "ghost", disabled }: {
  children: React.ReactNode; onClick?: () => void; variant?: "primary" | "ghost"; disabled?: boolean;
}) {
  const base = "inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-bold transition disabled:opacity-40";
  const styles = variant === "primary"
    ? "grad text-[#04110d] shadow-glow hover:-translate-y-px"
    : "border border-line2 text-t1 hover:text-t0 hover:bg-bg3";
  return <button className={`${base} ${styles}`} onClick={onClick} disabled={disabled}>{children}</button>;
}

export function Pill({ children, tone = "t1" }: { children: React.ReactNode; tone?: string }) {
  const color: Record<string, string> = {
    mint: "text-mint border-mint/30", amber: "text-amber border-amber/30",
    coral: "text-coral border-coral/30", t1: "text-t1 border-line2",
  };
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[11px] ${color[tone] || color.t1}`}>
      {children}
    </span>
  );
}

export function statusTone(status: string): string {
  return { running: "mint", waiting_human: "amber", completed: "mint", failed: "coral", pending: "t1" }[status] || "t1";
}
