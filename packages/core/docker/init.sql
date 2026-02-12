-- Supabase bootstrap: ensure supabase_admin exists before image's migrate.sh runs.
-- Other roles (authenticator, supabase_auth_admin, supabase_storage_admin) are
-- created by the image's own init-scripts and must NOT be pre-created here,
-- as that would cause ON_ERROR_STOP failures in migrate.sh.
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'supabase_admin') THEN
    CREATE ROLE supabase_admin LOGIN SUPERUSER PASSWORD 'postgres';
  ELSE
    ALTER ROLE supabase_admin WITH LOGIN SUPERUSER PASSWORD 'postgres';
  END IF;
END
$$;
