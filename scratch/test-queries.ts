import 'dotenv/config';
import path from 'path';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';

async function main() {
  const dbPath = path.resolve(process.cwd(), 'dev.db');
  const adapter = new PrismaBetterSqlite3({ url: `file:${dbPath}` });
  const prisma = new PrismaClient({ adapter });

  try {
    console.log('Testing auditLog query...');
    const logs = await prisma.auditLog.findMany({ take: 5 });
    console.log('Audit logs found:', logs.length);
  } catch (err) {
    console.error('AuditLog error:', err);
  }

  try {
    console.log('Testing learningLog query...');
    const learning = await prisma.learningLog.findMany({ take: 5 });
    console.log('Learning logs found:', learning.length);
  } catch (err) {
    console.error('LearningLog error:', err);
  }

  await prisma.$disconnect();
}

main();
