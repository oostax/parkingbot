import { sql } from '@vercel/postgres';

// Create the parking table
export async function createParkingTable() {
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS parkings (
        id VARCHAR(255) PRIMARY KEY,
        name VARCHAR(255),
        street VARCHAR(255),
        house VARCHAR(255),
        subway VARCHAR(255),
        total_spaces INTEGER,
        free_spaces INTEGER,
        handicapped_total INTEGER,
        handicapped_free INTEGER,
        area VARCHAR(50),
        lat DOUBLE PRECISION,
        lng DOUBLE PRECISION,
        last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;
    console.log('Parking table created successfully');
  } catch (error) {
    console.error('Error creating parking table:', error);
    throw error;
  }
}

// Create the users table
export async function createUserTable() {
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(255) PRIMARY KEY,
        name VARCHAR(255),
        email VARCHAR(255),
        image VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;
    console.log('Users table created successfully');
  } catch (error) {
    console.error('Error creating users table:', error);
    throw error;
  }
}

// Create the favorites table
export async function createFavoritesTable() {
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS favorites (
        id SERIAL PRIMARY KEY,
        user_id VARCHAR(255) REFERENCES users(id) ON DELETE CASCADE,
        parking_id VARCHAR(255) REFERENCES parkings(id) ON DELETE CASCADE,
        notify_enabled BOOLEAN DEFAULT TRUE,
        UNIQUE(user_id, parking_id)
      );
    `;
    console.log('Favorites table created successfully');
  } catch (error) {
    console.error('Error creating favorites table:', error);
    throw error;
  }
}

// Create the parking stats table
export async function createParkingStatsTable() {
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS parking_stats (
        id SERIAL PRIMARY KEY,
        parking_id VARCHAR(255) REFERENCES parkings(id) ON DELETE CASCADE,
        timestamp TIMESTAMP,
        free_spaces INTEGER,
        total_spaces INTEGER
      );
    `;
    console.log('Parking stats table created successfully');
  } catch (error) {
    console.error('Error creating parking stats table:', error);
    throw error;
  }
}

// Create the daily stats table for forecasts
export async function createDailyStatsTable() {
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS daily_stats (
        id SERIAL PRIMARY KEY,
        parking_id VARCHAR(255) REFERENCES parkings(id) ON DELETE CASCADE,
        hour INTEGER,
        avg_free_spaces REAL,
        avg_occupancy REAL,
        sample_count INTEGER,
        last_updated DATE,
        UNIQUE(parking_id, hour)
      );
    `;
    console.log('Daily stats table created successfully');
  } catch (error) {
    console.error('Error creating daily stats table:', error);
    throw error;
  }
}

// Initialize all database tables
export async function initializeDatabase() {
  await createParkingTable();
  await createUserTable();
  await createFavoritesTable();
  await createParkingStatsTable();
  await createDailyStatsTable();
} 