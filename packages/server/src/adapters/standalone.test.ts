import { describe, it, expect } from "vitest";
import { createStandaloneAdapter } from "./standalone.js";
import type { AvatarBackend } from "./types.js";

describe("createStandaloneAdapter", () => {
  it("returns an object implementing AvatarBackend", () => {
    const adapter = createStandaloneAdapter({
      openaiApiKey: "test-key",
    });

    expect(adapter).toHaveProperty("transcribe");
    expect(adapter).toHaveProperty("chat");
    expect(adapter).toHaveProperty("synthesize");
    expect(typeof adapter.transcribe).toBe("function");
    expect(typeof adapter.chat).toBe("function");
    expect(typeof adapter.synthesize).toBe("function");
  });
});
