/**
 * Shared type definitions for supabase-tools ecosystem.
 *
 * These types are consumed by both @sbtools/core and all plugins.
 */

/**
 * Metadata for a database snapshot produced by db-snapshot and consumed by db-visualize.
 * Written to {snapshot}/_meta/snapshot.json (default: .sbt/snapshot/_meta/snapshot.json).
 */
export interface SnapshotMeta {
    timestamp: string;
    database_url: string;
    postgres_version: string;
    object_counts: {
        functions: number;
        views: number;
        materialized_views: number;
        triggers: number;
        policies: number;
        types: number;
        enums: number;
        /** Plugin-contributed counts are keyed by their category name. */
        [key: string]: number;
    };
}

export interface ArgInfo {
    name: string;
    type: string;
    mode?: string;
}

export interface BaseItem {
    id: string;
    kind: string;
    schema: string;
    name: string;
    sql: string;
    description?: string;
}

export interface FunctionItem extends BaseItem {
    kind: "function";
    signature: string;
    args: ArgInfo[];
    returns: string;
    volatility: string;
    security_definer: boolean;
}

export interface ViewItem extends BaseItem {
    kind: "view" | "materialized_view";
}

export interface TriggerItem extends BaseItem {
    kind: "trigger";
    table: string;
    timing: string;
    events: string;
    function_name: string;
}

export interface PolicyItem extends BaseItem {
    kind: "policy";
    table: string;
    permissive: string;
    command: string;
    roles: string;
    using: string;
    with_check: string;
}

export interface TypeItem extends BaseItem {
    kind: "type";
    type_kind: string;
}

export interface EnumItem extends BaseItem {
    kind: "enum";
    values: string[];
}

export interface AtlasData {
    meta: SnapshotMeta & { generated_at: string };
    schemas: string[];
    categories: {
        functions: FunctionItem[];
        views: ViewItem[];
        materialized_views: ViewItem[];
        triggers: TriggerItem[];
        policies: PolicyItem[];
        types: TypeItem[];
        enums: EnumItem[];
        /** Plugin-contributed categories are keyed by their category name. */
        [key: string]: unknown[];
    };
}

/** Policy row shape from pg_policies (query uses policyname AS policy_name). */
export interface PolicyRow {
    schema: string;
    table_name: string;
    policy_name: string;
    permissive?: boolean;
    roles?: string | string[];
    cmd?: string;
    qual?: string;
    with_check?: string;
}

/** Parameterized schema filter for safe SQL queries. */
export interface SchemaFilter {
    clause: string;
    params: string[];
}

/** Context passed to each extractor: output dir, schema filters, and mutable metadata. */
export interface SnapshotContext {
    outDir: string;
    schemaFilterNsp: SchemaFilter;
    schemaFilterSchemaname: SchemaFilter;
    meta: SnapshotMeta;
}

/** Type row from pg_type (custom types query). */
export interface TypeRow {
    schema: string;
    name: string;
    definition: string;
    type_kind: string;
}

/** Enum row from pg_type/pg_enum. */
export interface EnumRow {
    schema: string;
    name: string;
    values: string[] | string;
}
