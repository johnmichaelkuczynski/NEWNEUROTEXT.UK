import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";

neonConfig.webSocketConstructor = ws;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Clean the DATABASE_URL - remove quotes and decode HTML entities
let cleanConnectionString = process.env.DATABASE_URL
  .replace(/^['"]|['"]$/g, '') // Remove leading/trailing quotes
  .replace(/&amp;/g, '&');      // Decode HTML ampersand

// Parse and log connection details (without password)
try {
  const dbUrl = new URL(cleanConnectionString);
  console.log(`[DB] Connecting to Neon database:`);
  console.log(`[DB]   Host: ${dbUrl.hostname}`);
  console.log(`[DB]   Database: ${dbUrl.pathname.slice(1)}`);
  console.log(`[DB]   User: ${dbUrl.username}`);
  console.log(`[DB]   SSL: enabled (Neon default)`);
} catch (e) {
  console.log(`[DB] DATABASE_URL configured (could not parse for logging)`);
}

export const pool = new Pool({ connectionString: cleanConnectionString });
export const db = drizzle({ client: pool, schema });

// Log when pool connects
pool.on('connect', () => {
  console.log('[DB] Pool connection established to Neon');
});

pool.on('error', (err) => {
  console.error('[DB] Pool error:', err.message);
});