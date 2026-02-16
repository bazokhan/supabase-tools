import { describe, it, expect } from "vitest";
import "../src/commands/register-core.js";
import { getCommand, allCommands } from "../src/command-registry.js";

describe("cli-routing", () => {
  it("getCommand returns core command by name", () => {
    const snapshot = getCommand("snapshot");
    expect(snapshot).toBeDefined();
    expect(snapshot?.name).toBe("snapshot");
    expect(snapshot?.description).toContain("Export");
  });

  it("getCommand returns undefined for unknown command", () => {
    expect(getCommand("nonexistent-xyz")).toBeUndefined();
  });

  it("allCommands returns non-empty array of core commands", () => {
    const commands = allCommands();
    expect(Array.isArray(commands)).toBe(true);
    expect(commands.length).toBeGreaterThan(0);
    const names = new Set(commands.map((c) => c.name));
    expect(names.has("snapshot")).toBe(true);
    expect(names.has("generate-atlas")).toBe(true);
    expect(names.has("init")).toBe(true);
  });
});
