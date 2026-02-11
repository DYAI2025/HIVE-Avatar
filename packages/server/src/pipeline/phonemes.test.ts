import { describe, it, expect, vi } from "vitest";
import { extractPhonemes } from "./phonemes.js";
import { execFile } from "node:child_process";

vi.mock("node:child_process", () => ({
  execFile: vi.fn(),
}));

describe("extractPhonemes", () => {
  it("calls rhubarb with correct arguments and parses JSON output", async () => {
    const mockOutput = JSON.stringify({
      mouthCues: [
        { start: 0.0, end: 0.5, value: "B" },
        { start: 0.5, end: 1.0, value: "D" },
      ],
    });

    const mockedExecFile = vi.mocked(execFile);
    mockedExecFile.mockImplementation(
      (_cmd: any, _args: any, _opts: any, cb: any) => {
        cb(null, mockOutput, "");
        return {} as any;
      },
    );

    const result = await extractPhonemes(
      Buffer.from("fake-wav"),
      "Hello world",
    );

    expect(result).toHaveLength(2);
    expect(result[0].shape).toBe("B");
    expect(result[1].shape).toBe("D");

    expect(mockedExecFile).toHaveBeenCalledWith(
      expect.stringContaining("rhubarb"),
      expect.arrayContaining([
        "--exportFormat",
        "json",
        "--recognizer",
        "phonetic",
      ]),
      expect.any(Object),
      expect.any(Function),
    );
  });
});
