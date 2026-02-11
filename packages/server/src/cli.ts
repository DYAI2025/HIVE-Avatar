#!/usr/bin/env node
import { createServer } from "./server.js";
import { createStandaloneAdapter } from "./adapters/standalone.js";
import { createSelineAdapter } from "./adapters/seline.js";

const port = parseInt(process.env.AVATAR_PORT ?? "3100", 10);
const host = process.env.AVATAR_HOST ?? "127.0.0.1";
const provider = process.env.AVATAR_PROVIDER ?? "standalone";

let backend;

if (provider === "seline") {
  const baseUrl = process.env.SELINE_URL ?? "http://localhost:3000";
  const characterId = process.env.SELINE_CHARACTER_ID;
  backend = createSelineAdapter({ baseUrl, characterId });
  console.log(`Using Seline adapter → ${baseUrl}${characterId ? ` (character: ${characterId})` : ""}`);
} else {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error("OPENAI_API_KEY required for standalone mode");
    process.exit(1);
  }
  backend = createStandaloneAdapter({
    openaiApiKey: apiKey,
    model: process.env.AVATAR_MODEL ?? "gpt-4o",
    voice: process.env.AVATAR_VOICE ?? "nova",
    systemPrompt: process.env.AVATAR_SYSTEM_PROMPT,
  });
  console.log("Using standalone adapter (OpenAI)");
}

await createServer({ port, host, backend });
console.log(`Avatar server running on ws://${host}:${port}/ws`);
