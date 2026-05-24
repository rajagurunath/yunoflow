// Voice capture via the browser's built-in Web Speech API (Chrome/Edge).
// No server-side STT needed — the browser transcribes locally.

type Handlers = { onText: (t: string) => void; onEnd?: () => void; onError?: (e: string) => void };

export function voiceSupported(): boolean {
  return typeof window !== "undefined" &&
    Boolean((window as any).webkitSpeechRecognition || (window as any).SpeechRecognition);
}

export function startVoice(h: Handlers): { stop: () => void } | null {
  const SR = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
  if (!SR) return null;
  const rec = new SR();
  rec.lang = "en-US";
  rec.interimResults = true;
  rec.continuous = false;
  rec.onresult = (ev: any) => {
    const text = Array.from(ev.results).map((r: any) => r[0].transcript).join(" ");
    h.onText(text);
  };
  rec.onerror = (ev: any) => h.onError?.(ev.error || "voice error");
  rec.onend = () => h.onEnd?.();
  rec.start();
  return { stop: () => rec.stop() };
}
