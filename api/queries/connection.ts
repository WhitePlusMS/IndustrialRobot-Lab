// api/queries/connection.ts
import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import * as schema from "@db/schema";

const dbPath = process.env.DATABASE_URL?.replace(/^file:/, "") || "./db.sqlite";

let instance: ReturnType<typeof drizzle<typeof schema>>;
let dbConn: Database.Database;

export function getDb() {
  if (!instance) {
    dbConn = new Database(dbPath);
    dbConn.exec("PRAGMA journal_mode = WAL;");
    instance = drizzle(dbConn, { schema });
  }
  return instance;
}
