import 'dotenv/config';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { PrismaPg } from '@prisma/adapter-pg';

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not set.');
  }
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
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
