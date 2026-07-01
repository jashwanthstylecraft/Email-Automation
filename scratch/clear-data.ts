import 'dotenv/config';
import { prisma } from '../src/lib/prisma';

async function main() {
  console.log('Clearing database tables...');
  await prisma.autoReply.deleteMany({});
  await prisma.email.deleteMany({});
  await prisma.auditLog.deleteMany({});
  console.log('Successfully cleared all emails, drafts, and audit logs.');
}

main()
  .catch((e) => {
    console.error(e);
  })
  .finally(async () => {
    // Adapter doesn't need explicit disconnect, but we call it if defined
  });
