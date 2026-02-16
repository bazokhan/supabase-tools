import { describe, it, expect } from "vitest";
import { hasFlag, getArg } from "../src/cli-utils.js";

describe("hasFlag", () => {
  it("returns true when args contains the flag", () => {
    expect(hasFlag(["--help"], "--help")).toBe(true);
    expect(hasFlag(["a", "-h", "b"], "-h")).toBe(true);
  });

  it("returns true when args contains any of multiple flags", () => {
    expect(hasFlag(["--json"], "--json", "--help")).toBe(true);
    expect(hasFlag(["--help"], "--json", "--help")).toBe(true);
  });

  it("returns false when flag is absent", () => {
    expect(hasFlag(["--other"], "--help")).toBe(false);
    expect(hasFlag([], "--help")).toBe(false);
  });
});

describe("getArg", () => {
  it("returns value after the flag", () => {
    expect(getArg(["--port", "8080"], "--port")).toBe("8080");
    expect(getArg(["a", "--foo", "bar", "b"], "--foo")).toBe("bar");
  });

  it("returns undefined when flag is absent", () => {
    expect(getArg(["--other"], "--port")).toBeUndefined();
  });

  it("returns undefined when flag has no following value", () => {
    expect(getArg(["--port"], "--port")).toBeUndefined();
  });

  it("returns undefined when flag is last", () => {
    expect(getArg(["a", "b", "--port"], "--port")).toBeUndefined();
  });
});
