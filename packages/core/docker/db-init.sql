-- Post-init bootstrapper: ensure roles/passwords and auth function ownership
-- are correct. Runs after DB is healthy (image migrations already completed).

DO $$
BEGIN
  ALTER ROLE supabase_admin WITH LOGIN SUPERUSER PASSWORD 'postgres';
  ALTER ROLE supabase_auth_admin WITH LOGIN PASSWORD 'postgres' NOINHERIT CREATEROLE;
  ALTER ROLE supabase_storage_admin WITH LOGIN PASSWORD 'postgres' NOINHERIT CREATEROLE;
  ALTER ROLE authenticator WITH LOGIN PASSWORD 'postgres' NOINHERIT;
END
$$;

GRANT anon, authenticated, service_role TO authenticator;
GRANT anon, authenticated, service_role TO supabase_storage_admin;
CREATE SCHEMA IF NOT EXISTS graphql_public AUTHORIZATION supabase_admin;
GRANT USAGE ON SCHEMA graphql_public TO anon, authenticated, service_role;
CREATE SCHEMA IF NOT EXISTS _realtime AUTHORIZATION supabase_admin;

-- Fix auth function ownership so GoTrue (supabase_auth_admin) can replace them
DO $$
BEGIN
  ALTER FUNCTION auth.uid() OWNER TO supabase_auth_admin;
  ALTER FUNCTION auth.role() OWNER TO supabase_auth_admin;
  ALTER FUNCTION auth.email() OWNER TO supabase_auth_admin;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'auth functions ownership transfer skipped: %', SQLERRM;
END
$$;
GRANT ALL ON SCHEMA auth TO supabase_auth_admin;
GRANT CREATE ON SCHEMA public TO supabase_auth_admin;
GRANT CREATE ON SCHEMA public TO supabase_storage_admin;
GRANT CREATE ON DATABASE postgres TO supabase_storage_admin;

-- Ensure PostgREST can see public tables/functions by default.
-- Supabase relies on RLS for access control, so broad grants are expected here.
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  GRANT ALL ON FUNCTIONS TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public
  GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public
  GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public
  GRANT ALL ON FUNCTIONS TO anon, authenticated, service_role;

-- Enable pg_stat_statements for query performance monitoring.
-- The extension is pre-loaded via shared_preload_libraries in the Supabase image.
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
