import { describe, it, expect } from "vitest";
import { mapType, buildMermaid } from "../src/builder.js";
import type { ColumnInfo, ForeignKeyInfo, ReferencedColumn } from "../src/builder.js";

describe("mapType", () => {
  it("maps uuid", () => expect(mapType("uuid", "uuid")).toBe("uuid"));
  it("maps text and character varying to text", () => {
    expect(mapType("text", "text")).toBe("text");
    expect(mapType("character varying", "varchar")).toBe("text");
  });
  it("maps boolean", () => expect(mapType("boolean", "bool")).toBe("boolean"));
  it("maps integer types", () => {
    expect(mapType("integer", "int4")).toBe("integer");
    expect(mapType("bigint", "int8")).toBe("bigint");
  });
  it("maps numeric", () => expect(mapType("numeric", "numeric")).toBe("numeric"));
  it("maps jsonb and json", () => {
    expect(mapType("jsonb", "jsonb")).toBe("jsonb");
    expect(mapType("json", "json")).toBe("json");
  });
  it("maps timestamp variants to timestamp", () => {
    expect(mapType("timestamp with time zone", "timestamptz")).toBe("timestamp");
    expect(mapType("timestamp without time zone", "timestamp")).toBe("timestamp");
  });
  it("maps ARRAY with udt_name", () => expect(mapType("ARRAY", "_text")).toBe("text[]"));
  it("maps USER-DEFINED to udt_name", () => expect(mapType("USER-DEFINED", "my_enum")).toBe("my_enum"));
});

describe("buildMermaid", () => {
  const columns: ColumnInfo[] = [
    { column_name: "id", data_type: "uuid", udt_name: "uuid", is_nullable: "NO", is_primary_key: true, is_foreign_key: false },
    { column_name: "name", data_type: "text", udt_name: "text", is_nullable: "YES", is_primary_key: false, is_foreign_key: false },
  ];
  const foreignKeys: ForeignKeyInfo[] = [
    { column_name: "owner_id", foreign_table_schema: "public", foreign_table_name: "users", foreign_column_name: "id", delete_rule: "NO ACTION", is_nullable: "YES" },
  ];
  const referencedEntities = new Map<string, ReferencedColumn[]>();
  referencedEntities.set("public.users", [
    { column_name: "id", is_primary_key: true, is_foreign_key: false, data_type: "uuid", udt_name: "uuid" },
  ]);

  it("produces mermaid erDiagram block", () => {
    const result = buildMermaid("posts", columns, foreignKeys, referencedEntities);
    expect(result).toContain("```mermaid");
    expect(result).toContain("erDiagram");
    expect(result).toContain("posts");
    expect(result).toContain("users");
  });

  it("includes column definitions with PK/FK annotations", () => {
    const result = buildMermaid("posts", columns, [], new Map());
    expect(result).toContain("uuid id PK");
    expect(result).toContain("text name");
  });
});
