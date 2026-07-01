import { PrismaClient } from '@/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const getPrisma = () => {
  // Constructing the adapter/client is lazy (no connection attempt happens
  // here), so this is safe to import even when DATABASE_URL isn't set yet
  // (e.g. pure-logic unit tests that never touch the database).
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  return new PrismaClient({ adapter });
};

export const prisma = globalForPrisma.prisma ?? getPrisma();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
