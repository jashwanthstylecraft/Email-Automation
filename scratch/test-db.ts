import 'dotenv/config';
import path from 'path';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';

async function main() {
  const dbPath = path.resolve(process.cwd(), 'dev.db');
  console.log('Using database path:', dbPath);
  const adapter = new PrismaBetterSqlite3({
    url: `file:${dbPath}`
  });
  const prisma = new PrismaClient({ adapter });
  try {
    const users = await prisma.user.findMany();
    console.log('Connected! Current users:', users);
  } catch (error) {
    console.error('Error connecting to database:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
