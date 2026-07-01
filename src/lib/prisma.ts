import { PrismaClient } from '@/generated/prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import path from 'path';

// Resolve database path relative to root
const dbPath = path.resolve(process.cwd(), 'dev.db');

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const getPrisma = () => {
  const adapter = new PrismaBetterSqlite3({
    url: `file:${dbPath}`
  });
  return new PrismaClient({ adapter });
};

export const prisma = globalForPrisma.prisma ?? getPrisma();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
