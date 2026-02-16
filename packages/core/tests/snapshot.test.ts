import { describe, it, expect } from "vitest";
import { runSnapshot } from "../src/commands/snapshot.js";

describe("snapshot", () => {
  it("exports runSnapshot as async function", () => {
    expect(typeof runSnapshot).toBe("function");
    expect(runSnapshot.constructor.name).toBe("AsyncFunction");
  });
});
