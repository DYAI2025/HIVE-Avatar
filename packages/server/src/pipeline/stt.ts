import OpenAI from "openai";
import { File } from "node:buffer";

export async function transcribe(
  client: OpenAI,
  wavAudio: Buffer,
): Promise<string> {
  const file = new File([new Uint8Array(wavAudio)], "audio.wav", { type: "audio/wav" });

  const response = await client.audio.transcriptions.create({
    model: "whisper-1",
    file,
    response_format: "text",
  });

  return (response as unknown as string).trim();
}
