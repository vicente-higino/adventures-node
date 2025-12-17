import { createClient } from "@clickhouse/client"; // or '@clickhouse/client-web'
import env from "@/env";

const client = createClient({
    url: env.CH_MIGRATIONS_HOST,
    username: env.CH_MIGRATIONS_USER,
    password: env.CH_MIGRATIONS_PASSWORD,
    clickhouse_settings: { async_insert: 1 },
});

export default client;
