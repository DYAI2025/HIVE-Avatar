import { execFile } from "node:child_process";
import { writeFile, unlink, mkdtemp } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
import { mapRhubarbToVisemes, type VisemeCue } from "@dyai/avatar-shared";

const __dirname = dirname(fileURLToPath(import.meta.url));
const RHUBARB_BIN = join(__dirname, "..", "..", "bin", "rhubarb");

/**
 * Extract phoneme/viseme cues from a WAV audio buffer using rhubarb-lip-sync.
 *
 * Writes the audio and transcript to temp files, invokes the rhubarb binary,
 * parses the JSON output, and maps it to VisemeCue[] via the shared mapper.
 *
 * @param wavAudio - Raw WAV audio data as a Buffer
 * @param transcript - The text transcript to guide phoneme recognition
 * @returns Array of VisemeCue objects with timing and shape data
 */
export async function extractPhonemes(
  wavAudio: Buffer,
  transcript: string,
): Promise<VisemeCue[]> {
  const tmp = await mkdtemp(join(tmpdir(), "avatar-phonemes-"));
  const wavPath = join(tmp, "audio.wav");
  const dialogPath = join(tmp, "dialog.txt");

  try {
    await writeFile(wavPath, wavAudio);
    await writeFile(dialogPath, transcript);

    const stdout = await runRhubarb(wavPath, dialogPath);
    const parsed = JSON.parse(stdout);
    return mapRhubarbToVisemes(parsed);
  } finally {
    await unlink(wavPath).catch(() => {});
    await unlink(dialogPath).catch(() => {});
  }
}

function runRhubarb(wavPath: string, dialogPath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(
      RHUBARB_BIN,
      [
        wavPath,
        "--dialogFile",
        dialogPath,
        "--exportFormat",
        "json",
        "--recognizer",
        "phonetic",
        "--quiet",
      ],
      { timeout: 30_000, maxBuffer: 10 * 1024 * 1024 },
      (error, stdout, _stderr) => {
        if (error) {
          reject(error);
        } else {
          resolve(stdout);
        }
      },
    );
  });
}
