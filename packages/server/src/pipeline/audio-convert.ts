import ffmpeg from "fluent-ffmpeg";
import { Readable, PassThrough } from "node:stream";

export async function convertToWav(input: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const inputStream = Readable.from(input);
    const chunks: Buffer[] = [];
    const output = new PassThrough();

    output.on("data", (chunk: Buffer) => chunks.push(chunk));
    output.on("end", () => resolve(Buffer.concat(chunks)));

    ffmpeg(inputStream)
      .inputFormat("webm")
      .audioFrequency(16000)
      .audioChannels(1)
      .audioCodec("pcm_s16le")
      .format("wav")
      .on("error", reject)
      .pipe(output, { end: true });
  });
}
