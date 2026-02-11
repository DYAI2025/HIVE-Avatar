import { describe, it, expect } from "vitest";
import { mapRhubarbToVisemes, interpolateVisemes } from "./viseme-mapper.js";

describe("mapRhubarbToVisemes", () => {
  it("converts rhubarb mouthCues to VisemeCue array", () => {
    const rhubarbOutput = {
      mouthCues: [
        { start: 0.0, end: 0.07, value: "X" },
        { start: 0.07, end: 0.3, value: "B" },
        { start: 0.3, end: 0.6, value: "D" },
        { start: 0.6, end: 0.8, value: "X" },
      ],
    };

    const visemes = mapRhubarbToVisemes(rhubarbOutput);

    expect(visemes).toHaveLength(4);
    expect(visemes[0]).toEqual({
      time: 0.0,
      shape: "X",
      weight: 1.0,
      duration: 0.07,
    });
    expect(visemes[2].shape).toBe("D");
    expect(visemes[2].duration).toBeCloseTo(0.3);
  });

  it("returns empty array for empty input", () => {
    const visemes = mapRhubarbToVisemes({ mouthCues: [] });
    expect(visemes).toEqual([]);
  });
});

describe("interpolateVisemes", () => {
  it("returns idle blendshapes when no visemes", () => {
    const result = interpolateVisemes([], 0.5);
    expect(result).toEqual({});
  });

  it("returns correct blendshapes at exact cue time", () => {
    const visemes = [
      { time: 0.0, shape: "D", weight: 1.0, duration: 0.5 },
    ];

    const result = interpolateVisemes(visemes, 0.0);
    expect(result.jawOpen).toBeCloseTo(0.8);
  });

  it("interpolates between two cues", () => {
    const visemes = [
      { time: 0.0, shape: "X", weight: 1.0, duration: 0.2 },
      { time: 0.2, shape: "D", weight: 1.0, duration: 0.3 },
    ];

    // Midpoint of transition (within 80ms LERP window at boundary)
    const result = interpolateVisemes(visemes, 0.16);
    // Should be blending toward D
    expect(result.jawOpen).toBeGreaterThan(0);
    expect(result.jawOpen).toBeLessThan(0.8);
  });
});
