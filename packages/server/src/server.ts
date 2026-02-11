import Fastify from "fastify";
import { WebSocketServer, WebSocket } from "ws";
import type { AvatarBackend } from "./adapters/types.js";
import type { Message } from "@dyai/avatar-shared";
import { processUserAudio } from "./orchestrator.js";

export interface ServerConfig {
  port: number;
  host: string;
  backend: AvatarBackend;
}

export async function createServer(config: ServerConfig) {
  const { port, host, backend } = config;

  const fastify = Fastify({ logger: true });
  const wss = new WebSocketServer({ noServer: true });

  // Health endpoint
  fastify.get("/health", async () => ({ status: "ok" }));

  // Upgrade HTTP to WebSocket
  fastify.server.on("upgrade", (request, socket, head) => {
    if (request.url === "/ws") {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit("connection", ws, request);
      });
    } else {
      socket.destroy();
    }
  });

  wss.on("connection", (ws: WebSocket) => {
    const history: Message[] = [];

    ws.on("message", async (data: Buffer) => {
      try {
        // Binary data = audio from PTT
        const audioBuffer = Buffer.from(data);

        const { userText, assistantText } = await processUserAudio(
          backend,
          audioBuffer,
          history,
          {
            onStart: () => {
              ws.send(JSON.stringify({ type: "assistant.start" }));
            },
            onAudio: (audio, visemes, sentenceIndex, isFinal) => {
              // Send viseme data as JSON
              ws.send(
                JSON.stringify({
                  type: "assistant.audio",
                  visemes,
                  sentenceIndex,
                  isFinal,
                }),
              );
              // Send audio as binary
              ws.send(audio);
            },
            onDone: () => {
              ws.send(JSON.stringify({ type: "assistant.done" }));
            },
            onEmpty: () => {
              ws.send(JSON.stringify({ type: "assistant.empty" }));
            },
            onError: (error) => {
              ws.send(
                JSON.stringify({
                  type: "error",
                  message: error.message,
                  recoverable: true,
                }),
              );
            },
          },
        );

        // Update history
        if (userText) {
          history.push({ role: "user", content: userText });
          history.push({ role: "assistant", content: assistantText });

          // Keep history manageable (last 20 turns)
          while (history.length > 40) {
            history.shift();
          }
        }
      } catch (err) {
        ws.send(
          JSON.stringify({
            type: "error",
            message: err instanceof Error ? err.message : "Unknown error",
            recoverable: true,
          }),
        );
      }
    });
  });

  await fastify.listen({ port, host });
  return fastify;
}
