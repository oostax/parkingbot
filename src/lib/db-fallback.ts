// Fallback handler for Prisma errors - don't import Prisma types directly to avoid client-side issues
export function handlePrismaError(error: unknown): void {
  // Check error type by its name instead of instanceof to avoid importing Prisma types
  if (error && typeof error === 'object' && 'name' in error && error.name === 'PrismaClientInitializationError') {
    console.error('\n=== DATABASE CONNECTION ERROR ===');
    console.error('Failed to connect to PostgreSQL. Please check:');
    console.error('1. Is PostgreSQL installed and running?');
    console.error('2. Is the database "parkingbot" created?');
    console.error('3. Is the DATABASE_URL environment variable correct?');
    console.error('\nTo install PostgreSQL on Windows:');
    console.error('1. Download from https://www.postgresql.org/download/windows/');
    console.error('2. Run the installer and follow the instructions');
    console.error('3. Create database "parkingbot": CREATE DATABASE parkingbot;');
    console.error('\nAlternatively, use Docker:');
    console.error('docker run --name postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_USER=postgres -p 5432:5432 -d postgres');
    console.error('docker exec -it postgres createdb -U postgres parkingbot');
    console.error('\n=== DATABASE URL ===');
      // Safe access to process.env in case this is imported on the client
  if (typeof process !== 'undefined' && process.env && process.env.DATABASE_URL) {
    const dbUrl = process.env.DATABASE_URL.replace(/\/\/.*?@/, '//***:***@');
    console.error(`Current setting: ${dbUrl}`);
  } else {
    console.error('DATABASE_URL is not set or not accessible!');
  }
    console.error('===========================\n');
  } else {
    console.error('Database error:', error);
  }
}

// Mock data for development when database is unavailable
export const mockParkingStats = (hour: number) => {
  return Array(24).fill(0).map((_, i) => ({
    hour: i,
    avgFreeSpaces: Math.floor(Math.random() * 100),
    avg_occupancy: Math.random() * 0.8 + 0.1,
    sampleCount: Math.floor(Math.random() * 100),
    lastUpdated: new Date()
  }));
}; 