import { describe, it, expect } from "vitest";
import {
  parseHeader, parseArgs, extractDescription, parseReturns,
  parseVolatility, parseTriggerDetails, parsePolicyBlocks,
  parsePolicyDetail, parseEnumValues,
} from "../src/parsers/index.js";

describe("parseHeader", () => {
  it("extracts a labeled value from a SQL comment", () => {
    expect(parseHeader("-- Schema: public\n-- Function: foo()", "Schema")).toBe("public");
  });
  it("returns empty string for missing label", () => {
    expect(parseHeader("-- Schema: public", "Function")).toBe("");
  });
  it("trims extra whitespace around value", () => {
    expect(parseHeader("-- Schema:   public  ", "Schema")).toBe("public");
  });
  it("handles empty content", () => {
    expect(parseHeader("", "Schema")).toBe("");
  });
});

describe("parseArgs", () => {
  it("returns empty array for empty input", () => {
    expect(parseArgs("")).toEqual([]);
    expect(parseArgs("   ")).toEqual([]);
  });
  it("parses named arguments with types", () => {
    const result = parseArgs("p_id uuid, p_name text");
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ name: "p_id", type: "uuid", mode: undefined });
    expect(result[1]).toEqual({ name: "p_name", type: "text", mode: undefined });
  });
  it("assigns arg1, arg2 for unnamed arguments", () => {
    const result = parseArgs("uuid, text");
    expect(result[0].name).toBe("arg1");
    expect(result[1].name).toBe("arg2");
  });
  it("recognises argument modes", () => {
    const result = parseArgs("IN p_id uuid, OUT p_name text, INOUT p_val integer");
    expect(result[0].mode).toBe("IN");
    expect(result[1].mode).toBe("OUT");
    expect(result[2].mode).toBe("INOUT");
  });
  it("handles VARIADIC mode", () => {
    const result = parseArgs("VARIADIC p_ids uuid[]");
    expect(result[0].mode).toBe("VARIADIC");
  });
});

describe("extractDescription", () => {
  it("extracts first non-generated comment after CREATE", () => {
    const sql = "-- GENERATED: test\nCREATE FUNCTION foo()\n-- This is the description\nBEGIN END;";
    expect(extractDescription(sql)).toBe("This is the description");
  });
  it("returns empty string when there is no description", () => {
    expect(extractDescription("CREATE FUNCTION foo()\nBEGIN END;")).toBe("");
  });
});

describe("parseReturns", () => {
  it("extracts simple return type", () => {
    expect(parseReturns("RETURNS void LANGUAGE plpgsql")).toBe("void");
  });
  it("extracts TABLE return type", () => {
    const result = parseReturns("RETURNS TABLE(id uuid, name text) LANGUAGE plpgsql");
    expect(result).toContain("TABLE");
  });
  it("extracts SETOF return type", () => {
    expect(parseReturns("RETURNS SETOF public.users LANGUAGE plpgsql")).toContain("SETOF");
  });
  it("returns empty string when missing", () => {
    expect(parseReturns("LANGUAGE plpgsql")).toBe("");
  });
});

describe("parseVolatility", () => {
  it("detects IMMUTABLE", () => { expect(parseVolatility("IMMUTABLE")).toBe("IMMUTABLE"); });
  it("detects STABLE", () => { expect(parseVolatility("STABLE")).toBe("STABLE"); });
  it("detects VOLATILE", () => { expect(parseVolatility("VOLATILE")).toBe("VOLATILE"); });
  it("returns empty for none", () => { expect(parseVolatility("LANGUAGE sql")).toBe(""); });
});

describe("parseTriggerDetails", () => {
  it("parses a standard trigger", () => {
    const sql = "CREATE TRIGGER my_trigger BEFORE INSERT ON public.users EXECUTE FUNCTION handle_insert()";
    const result = parseTriggerDetails(sql);
    expect(result.timing).toBe("BEFORE");
    expect(result.events).toBe("INSERT");
    expect(result.function_name).toBe("handle_insert");
  });
  it("parses INSTEAD OF trigger", () => {
    const sql = "CREATE TRIGGER view_trigger INSTEAD OF INSERT ON public.my_view EXECUTE FUNCTION handle_view_insert()";
    const result = parseTriggerDetails(sql);
    expect(result.timing).toBe("INSTEAD OF");
    expect(result.events).toBe("INSERT");
    expect(result.function_name).toBe("handle_view_insert");
  });
  it("parses AFTER UPDATE trigger", () => {
    const sql = "CREATE TRIGGER after_up AFTER UPDATE ON t EXECUTE FUNCTION fn()";
    const result = parseTriggerDetails(sql);
    expect(result.timing).toBe("AFTER");
    expect(result.events).toBe("UPDATE");
  });
  it("returns empty for non-trigger SQL", () => {
    const result = parseTriggerDetails("SELECT 1");
    expect(result.timing).toBe("");
  });
});

describe("parsePolicyBlocks", () => {
  it("splits multiple policies", () => {
    const content = "-- Policy: alpha\nCREATE POLICY alpha;\n-- Policy: beta\nCREATE POLICY beta;";
    const blocks = parsePolicyBlocks(content);
    expect(blocks).toHaveLength(2);
    expect(blocks[0].name).toBe("alpha");
    expect(blocks[1].name).toBe("beta");
  });
  it("handles multi-policy file with full policy SQL", () => {
    const content = `-- Policy: allow_read
CREATE POLICY "allow_read" ON public.users AS PERMISSIVE FOR SELECT TO "authenticated" USING (true);
-- Policy: allow_insert
CREATE POLICY "allow_insert" ON public.users AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (true);`;
    const blocks = parsePolicyBlocks(content);
    expect(blocks).toHaveLength(2);
    expect(blocks[0].name).toBe("allow_read");
    expect(blocks[0].sql).toContain("SELECT");
    expect(blocks[1].name).toBe("allow_insert");
    expect(blocks[1].sql).toContain("INSERT");
  });
});

describe("parsePolicyDetail", () => {
  it("parses policy attributes", () => {
    const sql = `CREATE POLICY "test" ON t AS PERMISSIVE FOR SELECT TO "authenticated"\nUSING (true)\nWITH CHECK (true)`;
    const d = parsePolicyDetail(sql);
    expect(d.permissive).toBe("PERMISSIVE");
    expect(d.command).toBe("SELECT");
    expect(d.using).toBe("true");
    expect(d.with_check).toBe("true");
  });
});

describe("parseEnumValues", () => {
  it("extracts enum values from CREATE TYPE", () => {
    const sql = "CREATE TYPE status AS ENUM (\n  'active',\n  'inactive',\n  'archived'\n);";
    expect(parseEnumValues(sql)).toEqual(["active", "inactive", "archived"]);
  });
  it("returns empty array for no values", () => {
    expect(parseEnumValues("CREATE TYPE empty")).toEqual([]);
  });
});
