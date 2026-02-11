import { describe, it, expect } from "vitest";
import { splitIntoSentences } from "./orchestrator.js";

describe("splitIntoSentences", () => {
  it("splits on period", () => {
    expect(splitIntoSentences("Hello world. How are you?")).toEqual([
      "Hello world.",
      "How are you?",
    ]);
  });

  it("splits on question mark", () => {
    expect(splitIntoSentences("What? Really!")).toEqual(["What?", "Really!"]);
  });

  it("handles single sentence", () => {
    expect(splitIntoSentences("Hello world")).toEqual(["Hello world"]);
  });

  it("handles empty string", () => {
    expect(splitIntoSentences("")).toEqual([]);
  });

  it("does not split on abbreviations like Mr.", () => {
    expect(splitIntoSentences("Mr. Smith is here.")).toEqual([
      "Mr. Smith is here.",
    ]);
  });
});
