import type { AvatarBackend } from "./types.js";
import type { Message } from "@dyai/avatar-shared";

export interface SelineConfig {
  baseUrl: string;
  characterId?: string;
}

export function createSelineAdapter(config: SelineConfig): AvatarBackend {
  const { baseUrl, characterId } = config;

  return {
    async transcribe(audio: Buffer): Promise<string> {
      const formData = new FormData();
      formData.append(
        "file",
        new Blob([new Uint8Array(audio)], { type: "audio/wav" }),
        "audio.wav",
      );

      const res = await fetch(`${baseUrl}/api/avatar/transcribe`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) throw new Error(`Seline STT failed: ${res.status}`);
      const data = await res.json();
      return data.text;
    },

    async *chat(text: string, history: Message[]): AsyncIterable<string> {
      const res = await fetch(`${baseUrl}/api/avatar/chat`, {
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
          ...(characterId && { characterId }),
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
        if (chunk) yield chunk;
      }
    },

    async synthesize(text: string): Promise<Buffer> {
      const res = await fetch(`${baseUrl}/api/avatar/synthesize`, {
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
