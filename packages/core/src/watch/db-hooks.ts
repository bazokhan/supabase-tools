import type { Client } from "pg";

const CHANNEL = "sbt_watch_events";
const SCHEMA = "sbt_watch";
const TABLE_TRIGGER = "sbt_watch_on_schema_migrations";
const EVENT_TRIGGER = "sbt_watch_on_ddl";

export interface InstallDbHooksResult {
  eventTriggerInstalled: boolean;
}

/**
 * Installs helper schema/functions/triggers for watch notifications.
 * Event-trigger setup may fail under limited privileges; caller should degrade gracefully.
 */
export async function installDbWatchHooks(client: Client): Promise<InstallDbHooksResult> {
  await client.query(`CREATE SCHEMA IF NOT EXISTS ${SCHEMA};`);

  await client.query(`
    CREATE OR REPLACE FUNCTION ${SCHEMA}.notify_event()
    RETURNS trigger
    LANGUAGE plpgsql
    AS $$
    BEGIN
      PERFORM pg_notify(
        '${CHANNEL}',
        json_build_object(
          'kind', TG_OP,
          'schema', TG_TABLE_SCHEMA,
          'table', TG_TABLE_NAME,
          'at', now()::text
        )::text
      );
      RETURN NEW;
    END;
    $$;
  `);

  await client.query(`
    DO $$
    BEGIN
      IF to_regclass('app_migrations.schema_migrations') IS NOT NULL THEN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_trigger
          WHERE tgname = '${TABLE_TRIGGER}'
            AND tgrelid = 'app_migrations.schema_migrations'::regclass
        ) THEN
          EXECUTE 'CREATE TRIGGER ${TABLE_TRIGGER}
            AFTER INSERT OR UPDATE OR DELETE
            ON app_migrations.schema_migrations
            FOR EACH ROW
            EXECUTE FUNCTION ${SCHEMA}.notify_event()';
        END IF;
      END IF;
    END $$;
  `);

  await client.query(`
    CREATE OR REPLACE FUNCTION ${SCHEMA}.notify_ddl()
    RETURNS event_trigger
    LANGUAGE plpgsql
    AS $$
    DECLARE cmd record;
    BEGIN
      FOR cmd IN SELECT * FROM pg_event_trigger_ddl_commands() LOOP
        PERFORM pg_notify(
          '${CHANNEL}',
          json_build_object(
            'kind', 'DDL',
            'command', cmd.command_tag,
            'schema', cmd.schema_name,
            'object', cmd.object_identity,
            'at', now()::text
          )::text
        );
      END LOOP;
    END;
    $$;
  `);

  let eventTriggerInstalled = true;
  try {
    await client.query(`DROP EVENT TRIGGER IF EXISTS ${EVENT_TRIGGER};`);
    await client.query(`
      CREATE EVENT TRIGGER ${EVENT_TRIGGER}
      ON ddl_command_end
      EXECUTE FUNCTION ${SCHEMA}.notify_ddl();
    `);
  } catch {
    eventTriggerInstalled = false;
  }

  return { eventTriggerInstalled };
}

