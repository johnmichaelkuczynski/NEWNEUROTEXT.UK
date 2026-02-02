import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from "@shared/schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Clean the DATABASE_URL - remove quotes and decode HTML entities
let cleanConnectionString = process.env.DATABASE_URL
  .replace(/^['"]|['"]$/g, '')
  .replace(/&amp;/g, '&');

export const pool = new Pool({ 
  connectionString: cleanConnectionString,
  ssl: { rejectUnauthorized: false }
});
export const db = drizzle(pool, { schema });