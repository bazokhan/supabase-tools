import { describe, it, expect } from "vitest";
import { analyze } from "../src/analyzer.js";
import type { ScanResult } from "../src/scanner.js";

describe("analyzer", () => {
  it("returns empty structure for no results", () => {
    const result = analyze([]);
    expect(result.components).toEqual({});
    expect(result.byResource.table).toEqual([]);
    expect(result.byResource.rpc).toEqual([]);
    expect(result.stats).toEqual([]);
  });

  it("aggregates hits into components and byResource", () => {
    const results: ScanResult[] = [
      {
        file: "src/UserList.tsx",
        component: "UserList",
        hits: [
          { type: "table", resource: "users", line: 1, column: 0, snippet: ".from('users')" },
          { type: "rpc", resource: "get_users", line: 2, column: 0, snippet: ".rpc('get_users')" },
        ],
      },
      {
        file: "src/Profile.tsx",
        component: "Profile",
        hits: [
          { type: "table", resource: "users", line: 1, column: 0, snippet: ".from('users')" },
          { type: "table", resource: "profiles", line: 2, column: 0, snippet: ".from('profiles')" },
        ],
      },
    ];
    const data = analyze(results);
    expect(Object.keys(data.components)).toHaveLength(2);
    expect(data.components.UserList).toHaveLength(2);
    expect(data.components.Profile).toHaveLength(2);
    expect(data.byResource.table).toContain("users");
    expect(data.byResource.table).toContain("profiles");
    expect(data.byResource.rpc).toContain("get_users");
  });
});
