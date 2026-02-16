/**
 * Migration templates. Data-driven; adding a template = adding an entry.
 */
import type { MigrationTemplate } from "./types.js";

export const TEMPLATES: MigrationTemplate[] = [
  {
    id: "create-table-rls",
    name: "Create table with RLS",
    description: "CREATE TABLE with RLS enabled",
    category: "table",
    sql: `CREATE TABLE IF NOT EXISTS public.\${table_name} (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.\${table_name} ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for authenticated" ON public.\${table_name}
  FOR ALL TO authenticated USING (true);`,
  },
  {
    id: "add-column",
    name: "Add column",
    description: "ALTER TABLE ADD COLUMN with default",
    category: "column",
    sql: `ALTER TABLE public.\${table_name}
  ADD COLUMN IF NOT EXISTS \${column_name} \${column_type} DEFAULT \${default_value};`,
  },
  {
    id: "create-function",
    name: "Create function / RPC",
    description: "CREATE OR REPLACE FUNCTION (void)",
    category: "function",
    sql: `CREATE OR REPLACE FUNCTION public.\${function_name}()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  -- Add your logic here (no RETURN needed for void)
$$;`,
  },
  {
    id: "create-function-text",
    name: "Create function returning text",
    description: "CREATE OR REPLACE FUNCTION (LANGUAGE sql uses SELECT)",
    category: "function",
    sql: `CREATE OR REPLACE FUNCTION public.\${function_name}()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 'Hello world';
$$;`,
  },
  {
    id: "create-trigger",
    name: "Create trigger + function",
    description: "Trigger with function skeleton",
    category: "trigger",
    sql: `CREATE OR REPLACE FUNCTION public.\${function_name}()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- NEW.column = ...
  RETURN NEW;
END;
$$;

CREATE TRIGGER \${trigger_name}
  BEFORE INSERT ON public.\${table_name}
  FOR EACH ROW
  EXECUTE FUNCTION public.\${function_name}();`,
  },
  {
    id: "create-policy",
    name: "Create RLS policy",
    description: "CREATE POLICY for table",
    category: "policy",
    sql: `CREATE POLICY "\${policy_name}" ON public.\${table_name}
  FOR \${operation} TO \${role}
  USING (\${using_expr});`,
  },
  {
    id: "create-index",
    name: "Create index (CONCURRENTLY)",
    description: "CREATE INDEX CONCURRENTLY",
    category: "index",
    sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_\${table_name}_\${column_name}
  ON public.\${table_name} (\${column_name});`,
  },
  {
    id: "add-foreign-key",
    name: "Add foreign key",
    description: "ALTER TABLE ADD CONSTRAINT FK",
    category: "column",
    sql: `ALTER TABLE public.\${table_name}
  ADD CONSTRAINT fk_\${table_name}_\${ref_table}
  FOREIGN KEY (\${column_name}) REFERENCES public.\${ref_table}(\${ref_column});`,
  },
  {
    id: "create-enum",
    name: "Create enum type",
    description: "CREATE TYPE ... AS ENUM",
    category: "type",
    sql: `CREATE TYPE public.\${enum_name} AS ENUM (
  '\${value1}',
  '\${value2}'
);`,
  },
];
