import OpenAI from "openai";
import type { AvatarBackend } from "./types.js";
import type { Message } from "@dyai/avatar-shared";
import { transcribe } from "../pipeline/stt.js";
import { chatStream } from "../pipeline/llm.js";
import { synthesize } from "../pipeline/tts.js";

export interface StandaloneConfig {
  openaiApiKey: string;
  model?: string;
  voice?: string;
  systemPrompt?: string;
}

export function createStandaloneAdapter(
  config: StandaloneConfig,
): AvatarBackend {
  const client = new OpenAI({ apiKey: config.openaiApiKey });

  return {
    async transcribe(audio: Buffer): Promise<string> {
      return transcribe(client, audio);
    },

    async *chat(text: string, history: Message[]): AsyncIterable<string> {
      yield* chatStream(client, text, history, config.model, config.systemPrompt);
    },

    async synthesize(text: string): Promise<Buffer> {
      return synthesize(client, text, config.voice);
    },
  };
}
