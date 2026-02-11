import type { Message } from "@dyai/avatar-shared";

export interface AvatarBackend {
  transcribe(audio: Buffer): Promise<string>;
  chat(text: string, history: Message[]): AsyncIterable<string>;
  synthesize(text: string): Promise<Buffer>;
}
