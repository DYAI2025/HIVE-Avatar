import { describe, it, expect, afterAll, vi, beforeAll } from "vitest";

// Mock pipeline modules that require external binaries (ffmpeg, rhubarb)
vi.mock("./pipeline/audio-convert.js", () => ({
  convertToWav: vi.fn(async (buf: Buffer) => buf),
}));

vi.mock("./pipeline/phonemes.js", () => ({
  extractPhonemes: vi.fn(async () => [
    { time: 0, shape: "viseme_aa", weight: 1, duration: 0.1 },
  ]),
}));

import { createServer } from "./server.js";
import WebSocket from "ws";
import type { AvatarBackend } from "./adapters/types.js";

// ---------- Mock backend ----------

const mockBackend: AvatarBackend = {
  async transcribe(): Promise<string> {
    return "Hello";
  },

  async *chat(): AsyncIterable<string> {
    yield "Hi there. ";
    yield "How can I help?";
  },

  async synthesize(): Promise<Buffer> {
    // Minimal valid WAV header (44 bytes) + 1 second of silence at 16 kHz
    const header = Buffer.alloc(44);
    header.write("RIFF", 0);
    header.writeUInt32LE(32036, 4);
    header.write("WAVE", 8);
    header.write("fmt ", 12);
    header.writeUInt32LE(16, 16);
    header.writeUInt16LE(1, 20); // PCM
    header.writeUInt16LE(1, 22); // mono
    header.writeUInt32LE(16000, 24); // sample rate
    header.writeUInt32LE(32000, 28); // byte rate
    header.writeUInt16LE(2, 32); // block align
    header.writeUInt16LE(16, 34); // bits per sample
    header.write("data", 36);
    header.writeUInt32LE(32000, 40);
    return Buffer.concat([header, Buffer.alloc(32000)]);
  },
};

// ---------- Helpers ----------

/** Collect all WebSocket messages (JSON-parsed when possible) until `assistant.done`. */
function collectMessages(
  ws: WebSocket,
  timeoutMs = 10_000,
): Promise<Array<{ type: string; [k: string]: unknown } | Buffer>> {
  return new Promise((resolve, reject) => {
    const messages: Array<{ type: string; [k: string]: unknown } | Buffer> = [];
    const timer = setTimeout(() => {
      ws.close();
      reject(new Error(`Timed out after ${timeoutMs}ms waiting for assistant.done`));
    }, timeoutMs);

    ws.on("message", (data: Buffer | string, isBinary: boolean) => {
      if (isBinary) {
        messages.push(Buffer.from(data as Buffer));
        return;
      }
      try {
        const parsed = JSON.parse(data.toString());
        messages.push(parsed);
        if (parsed.type === "assistant.done") {
          clearTimeout(timer);
          resolve(messages);
        }
      } catch {
        // Non-JSON text, store as-is
        messages.push({ type: "unknown", raw: data.toString() });
      }
    });

    ws.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });

    ws.on("close", () => {
      clearTimeout(timer);
      // Resolve with whatever we collected, even without assistant.done
      resolve(messages);
    });
  });
}

// ---------- Test suite ----------

describe("E2E: WebSocket server", () => {
  const PORT = 19876; // unlikely to collide
  let server: Awaited<ReturnType<typeof createServer>>;

  beforeAll(async () => {
    server = await createServer({
      port: PORT,
      host: "127.0.0.1",
      backend: mockBackend,
    });
  });

  afterAll(async () => {
    await server.close();
  });

  it("health endpoint responds with ok", async () => {
    const res = await fetch(`http://127.0.0.1:${PORT}/health`);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body).toEqual({ status: "ok" });
  });

  it("full round-trip: audio in, assistant messages out", async () => {
    const ws = new WebSocket(`ws://127.0.0.1:${PORT}/ws`);

    // Wait for open
    await new Promise<void>((resolve, reject) => {
      ws.on("open", resolve);
      ws.on("error", reject);
    });

    // Start collecting before sending
    const collecting = collectMessages(ws);

    // Send fake audio (just some bytes, the mock doesn't care)
    ws.send(Buffer.from([0x00, 0x01, 0x02, 0x03]));

    const messages = await collecting;
    ws.close();

    // Extract JSON messages only (skip binary audio frames)
    const jsonMsgs = messages.filter(
      (m): m is { type: string; [k: string]: unknown } => !Buffer.isBuffer(m),
    );

    const types = jsonMsgs.map((m) => m.type);

    // Must start with assistant.start and end with assistant.done
    expect(types[0]).toBe("assistant.start");
    expect(types[types.length - 1]).toBe("assistant.done");

    // Must contain at least one assistant.audio message
    expect(types).toContain("assistant.audio");

    // assistant.audio messages must have visemes and sentenceIndex
    const audioMsgs = jsonMsgs.filter((m) => m.type === "assistant.audio");
    for (const msg of audioMsgs) {
      expect(msg).toHaveProperty("visemes");
      expect(msg).toHaveProperty("sentenceIndex");
      expect(msg).toHaveProperty("isFinal");
    }
  });
});
