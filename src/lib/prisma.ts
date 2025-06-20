import { PrismaClient } from '@prisma/client';

// Use the database URL from the environment or default to dev.db
const databaseUrl = process.env.DATABASE_URL || "file:./prisma/dev.db";

// Create a global prisma instance
const globalForPrisma = global as unknown as { prisma: PrismaClient };

// Export a singleton Prisma client
export const prisma = globalForPrisma.prisma || new PrismaClient({
  datasources: {
    db: {
      url: databaseUrl,
    },
  },
});

// Only assign to global object in development to prevent multiple instances
if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
} 