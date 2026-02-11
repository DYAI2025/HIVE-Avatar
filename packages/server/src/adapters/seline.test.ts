import { describe, it, expect } from "vitest";
import { createSelineAdapter } from "./seline.js";

describe("createSelineAdapter", () => {
  it("returns an object implementing AvatarBackend", () => {
    const adapter = createSelineAdapter({
      baseUrl: "http://localhost:3000",
    });

    expect(adapter).toHaveProperty("transcribe");
    expect(adapter).toHaveProperty("chat");
    expect(adapter).toHaveProperty("synthesize");
  });
});
