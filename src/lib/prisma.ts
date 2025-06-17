import { PrismaClient } from '@prisma/client';

// Явно указываем URL базы данных
const databaseUrl = "file:../pb/bot_database.db";

// Use a global instance to avoid multiple instances during hot reloads
const globalForPrisma = global as unknown as { prisma: PrismaClient };

// Создаем экземпляр Prisma с явным указанием URL
const prisma = globalForPrisma.prisma || new PrismaClient({
  datasources: {
    db: {
      url: databaseUrl,
    },
  },
});

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export default prisma; 