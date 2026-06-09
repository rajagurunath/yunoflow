// Voice capture. Primary path records audio (MediaRecorder, works in every
// modern browser) and sends it to the backend for ElevenLabs Scribe STT — higher
// accuracy, 99 languages, and the key stays server-side. The browser's Web Speech
// API (Chrome/Edge only) remains a no-network fallback.

export function recordingSupported(): boolean {
  return typeof navigator !== "undefined" &&
    !!navigator.mediaDevices?.getUserMedia &&
    typeof (window as any).MediaRecorder !== "undefined";
}

// Start recording the mic; call .stop() to end and get the captured audio Blob.
export async function startRecording(): Promise<{ stop: () => Promise<Blob> }> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const mr = new MediaRecorder(stream);
  const chunks: BlobPart[] = [];
  mr.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
  mr.start();
  return {
    stop: () => new Promise<Blob>((resolve) => {
      mr.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        resolve(new Blob(chunks, { type: mr.mimeType || "audio/webm" }));
      };
      mr.stop();
    }),
  };
}

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
