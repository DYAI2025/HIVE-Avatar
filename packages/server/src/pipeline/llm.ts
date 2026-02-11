import OpenAI from "openai";
import type { Message } from "@dyai/avatar-shared";

export async function* chatStream(
  client: OpenAI,
  text: string,
  history: Message[],
  model: string = "gpt-4o",
  systemPrompt: string = "You are a helpful assistant. Keep responses concise (1-3 sentences).",
): AsyncIterable<string> {
  const messages = [
    { role: "system" as const, content: systemPrompt },
    ...history.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
    { role: "user" as const, content: text },
  ];

  const stream = await client.chat.completions.create({
    model,
    messages,
    stream: true,
  });

  for await (const chunk of stream) {
    const content = chunk.choices[0]?.delta?.content;
    if (content) yield content;
  }
}
