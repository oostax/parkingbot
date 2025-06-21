// This module ensures environment variables are loaded
import { config } from 'dotenv';

// Load environment variables from multiple .env files
config({ path: '.env.development' });
config({ path: '.env.local' });
config({ path: '.env' });

// The SQLite connection string
const DATABASE_URL = 'file:./prisma/dev.db';

// Set DATABASE_URL both as a module export and as a global environment variable
if (typeof process !== 'undefined' && process.env) {
  // Set the environment variable if it's not already set
  if (!process.env.DATABASE_URL) {
    console.log('Setting DATABASE_URL environment variable with default value');
    process.env.DATABASE_URL = DATABASE_URL;
  } else {
    console.log('DATABASE_URL environment variable already set');
  }

  // Log the DATABASE_URL value
  console.log(`Current DATABASE_URL: ${process.env.DATABASE_URL}`);
}

// Set the variable in global scope for Prisma
if (typeof global !== 'undefined') {
  (global as any).DATABASE_URL = process.env.DATABASE_URL || DATABASE_URL;
}

export default {
  DATABASE_URL: process.env.DATABASE_URL || DATABASE_URL
}; 