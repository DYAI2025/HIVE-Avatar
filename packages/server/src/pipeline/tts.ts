import OpenAI from "openai";

export async function synthesize(
  client: OpenAI,
  text: string,
  voice: string = "nova",
): Promise<Buffer> {
  const response = await client.audio.speech.create({
    model: "tts-1",
    voice: voice as any,
    input: text,
    response_format: "wav",
    speed: 1.0,
  });

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}
