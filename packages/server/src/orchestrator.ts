import type { AvatarBackend } from "./adapters/types.js";
import type { Message, VisemeCue } from "@dyai/avatar-shared";
import { extractPhonemes } from "./pipeline/phonemes.js";
import { convertToWav } from "./pipeline/audio-convert.js";

const ABBREVIATIONS = new Set([
  "mr",
  "mrs",
  "ms",
  "dr",
  "prof",
  "sr",
  "jr",
  "st",
  "vs",
  "etc",
  "inc",
  "ltd",
]);
const SENTENCE_END = /([.!?])\s+/g;
const MAX_SENTENCES = 20;

export function splitIntoSentences(text: string): string[] {
  if (!text.trim()) return [];

  const result: string[] = [];
  const remaining = text.trim();

  let match: RegExpExecArray | null;
  let lastIndex = 0;
  SENTENCE_END.lastIndex = 0;

  while ((match = SENTENCE_END.exec(remaining)) !== null) {
    const candidate = remaining.slice(lastIndex, match.index + 1).trim();

    // Check if the period follows an abbreviation
    const lastWord =
      candidate
        .split(/\s+/)
        .pop()
        ?.replace(/[.!?]$/, "")
        .toLowerCase() ?? "";
    if (match[1] === "." && ABBREVIATIONS.has(lastWord)) {
      continue;
    }

    if (candidate) result.push(candidate);
    lastIndex = match.index + match[0].length;
  }

  const tail = remaining.slice(lastIndex).trim();
  if (tail) result.push(tail);

  return result;
}

export interface OrchestratorCallbacks {
  onStart: () => void;
  onAudio: (
    audio: Buffer,
    visemes: VisemeCue[],
    sentenceIndex: number,
    isFinal: boolean,
  ) => void;
  onDone: () => void;
  onEmpty: () => void;
  onError: (error: Error) => void;
}

export async function processUserAudio(
  backend: AvatarBackend,
  audioBuffer: Buffer,
  history: Message[],
  callbacks: OrchestratorCallbacks,
): Promise<{ userText: string; assistantText: string }> {
  callbacks.onStart();

  // 1. Convert to WAV
  const wav = await convertToWav(audioBuffer);

  // 2. Transcribe
  const userText = await backend.transcribe(wav);
  if (!userText.trim()) {
    callbacks.onEmpty();
    return { userText: "", assistantText: "" };
  }

  // 3. Stream LLM response, collect sentences
  let fullText = "";
  let buffer = "";
  const sentenceQueue: string[] = [];
  let sentenceIndex = 0;
  let processingDone = false;

  // Start sentence processor in background
  const processNext = async () => {
    while (sentenceQueue.length > 0 || !processingDone) {
      if (sentenceQueue.length === 0) {
        await new Promise((r) => setTimeout(r, 50));
        continue;
      }

      const sentence = sentenceQueue.shift()!;
      const idx = sentenceIndex++;

      try {
        // TTS
        const audio = await backend.synthesize(sentence);

        // Convert to WAV for rhubarb
        const audioWav = await convertToWav(audio);

        // Phoneme extraction
        const visemes = await extractPhonemes(audioWav, sentence);

        const isFinal = sentenceQueue.length === 0 && processingDone;
        callbacks.onAudio(audio, visemes, idx, isFinal);
      } catch (err) {
        callbacks.onError(
          err instanceof Error ? err : new Error(String(err)),
        );
      }

      if (sentenceIndex >= MAX_SENTENCES) {
        processingDone = true;
        break;
      }
    }
  };

  const processor = processNext();

  // 4. Collect LLM stream into sentences
  for await (const chunk of backend.chat(userText, history)) {
    buffer += chunk;
    fullText += chunk;

    const sentences = splitIntoSentences(buffer);
    if (sentences.length > 1) {
      // All but last are complete sentences
      for (let i = 0; i < sentences.length - 1; i++) {
        sentenceQueue.push(sentences[i]);
      }
      buffer = sentences[sentences.length - 1];
    }
  }

  // Flush remaining buffer
  if (buffer.trim()) {
    sentenceQueue.push(buffer.trim());
  }
  processingDone = true;

  // Wait for all sentences to be processed
  await processor;

  callbacks.onDone();

  return { userText, assistantText: fullText };
}
