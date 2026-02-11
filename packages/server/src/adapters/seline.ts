import type { AvatarBackend } from "./types.js";
import type { Message } from "@dyai/avatar-shared";

export interface SelineConfig {
  baseUrl: string;
  agentId?: string;
  sessionId?: string;
}

export function createSelineAdapter(config: SelineConfig): AvatarBackend {
  const { baseUrl, agentId, sessionId } = config;

  return {
    async transcribe(audio: Buffer): Promise<string> {
      const formData = new FormData();
      formData.append(
        "file",
        new Blob([audio], { type: "audio/wav" }),
        "audio.wav",
      );

      const res = await fetch(`${baseUrl}/api/audio/transcribe`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) throw new Error(`Seline STT failed: ${res.status}`);
      const data = await res.json();
      return data.text;
    },

    async *chat(text: string, history: Message[]): AsyncIterable<string> {
      const res = await fetch(`${baseUrl}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [
            ...history.map((m) => ({
              role: m.role,
              content: m.content,
            })),
            { role: "user", content: text },
          ],
          ...(agentId && { agentId }),
          ...(sessionId && { sessionId }),
        }),
      });

      if (!res.ok) throw new Error(`Seline chat failed: ${res.status}`);
      if (!res.body) throw new Error("No response body");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        // Parse Seline's streaming format (data-stream protocol)
        for (const line of chunk.split("\n")) {
          if (line.startsWith("0:")) {
            // Text delta in Vercel AI SDK data stream
            try {
              const text = JSON.parse(line.slice(2));
              if (typeof text === "string") yield text;
            } catch {
              // skip non-JSON lines
            }
          }
        }
      }
    },

    async synthesize(text: string): Promise<Buffer> {
      const res = await fetch(`${baseUrl}/api/audio/synthesize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });

      if (!res.ok) throw new Error(`Seline TTS failed: ${res.status}`);
      const arrayBuffer = await res.arrayBuffer();
      return Buffer.from(arrayBuffer);
    },
  };
}
