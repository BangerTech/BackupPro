import { Pool } from 'pg';

// Create a connection pool to the PostgreSQL database
export const db = new Pool({
  host: process.env.DB_HOST || 'postgres',
  port: parseInt(process.env.DB_PORT || '5432'),
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_NAME || 'backup_schedule'
});

// Test the database connection
db.connect()
  .then(() => console.log('Connected to PostgreSQL database'))
  .catch((err: Error) => console.error('Error connecting to PostgreSQL database:', err));

// Export a function to run migrations
export const runMigrations = async () => {
  try {
    // Check if the targets table exists
    const tableCheck = await db.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'targets'
      );
    `);
    
    // If the table doesn't exist, create it
    if (!tableCheck.rows[0].exists) {
      await db.query(`
        CREATE TABLE IF NOT EXISTS targets (
          id UUID PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          type VARCHAR(50) NOT NULL,
          config JSONB DEFAULT '{}',
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
      `);
      console.log('Created targets table');
    }
  } catch (error: unknown) {
    console.error('Error running migrations:', error instanceof Error ? error.message : error);
  }
}; 