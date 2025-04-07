import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '@shared/schema';

// Create a connection to the database using the environment variable
const client = postgres(process.env.DATABASE_URL!);

// Initialize Drizzle with our schema
export const db = drizzle(client, { schema });