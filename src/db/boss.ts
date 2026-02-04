import { PgBoss } from "pg-boss";
import env from "@/env";

const boss = new PgBoss(env.DATABASE_URL);

export default boss;
