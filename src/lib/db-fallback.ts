// Fallback handler for Prisma errors - don't import Prisma types directly to avoid client-side issues
export function handlePrismaError(error: unknown): void {
  // Check error type by its name instead of instanceof to avoid importing Prisma types
  if (error && typeof error === 'object' && 'name' in error && error.name === 'PrismaClientInitializationError') {
    console.error('\n=== DATABASE CONNECTION ERROR ===');
    console.error('Failed to connect to SQLite database. Please check:');
    console.error('1. Is the database file accessible and not corrupted?');
    console.error('2. Do you have proper permissions to read/write the database file?');
    console.error('3. Is the DATABASE_URL environment variable correct?');
    console.error('\nTo fix SQLite connection issues:');
    console.error('1. Check that the path to the database file is correct');
    console.error('2. Ensure the directory exists and has proper permissions');
    console.error('3. Try running the setup-database.js script to initialize the database');
    console.error('\n=== DATABASE URL ===');
    // Safe access to process.env in case this is imported on the client
    if (typeof process !== 'undefined' && process.env && process.env.DATABASE_URL) {
      console.error(`Current setting: ${process.env.DATABASE_URL}`);
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