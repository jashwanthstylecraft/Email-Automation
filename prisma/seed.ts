import 'dotenv/config';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { PrismaPg } from '@prisma/adapter-pg';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not set. Point it at your Postgres connection string.');
}
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('Seeding StyleCraft US database...');

  // 1. Purge all existing tables in order
  console.log('Purging existing database tables...');
  await prisma.auditLog.deleteMany({});
  await prisma.autoReply.deleteMany({});
  await prisma.email.deleteMany({});
  await prisma.rule.deleteMany({});
  await prisma.document.deleteMany({});
  await prisma.template.deleteMany({});
  await prisma.inbox.deleteMany({});
  await prisma.settings.deleteMany({});
  await prisma.user.deleteMany({});
  await prisma.organization.deleteMany({});

  // 2. Create Organization
  const org = await prisma.organization.create({
    data: {
      name: 'StyleCraft US',
    },
  });
  console.log('Created Organization:', org.name);

  // 3. Create User (Admin)
  // Password hash is for 'password123'
  const passwordHash = '$2b$10$R9h/lIPzNgb.S7vBhfzopefU04F62Lh9Lw60B7vO7cT5q2.J8N5e2'; 
  const user = await prisma.user.create({
    data: {
      name: 'StyleCraft Admin',
      email: 'jane@stylecraftus.com',
      passwordHash,
      role: 'Admin',
      organizationId: org.id,
    },
  });
  console.log('Created User:', user.email);

  // 4. Create Settings (Configured for StyleCraft US beauty & grooming tools)
  const settings = await prisma.settings.create({
    data: {
      organizationId: org.id,
      systemPrompt: 'You are a customer support agent for StyleCraft US, a leading brand in beauty and grooming tools. Use only the uploaded knowledge base documents to answer customer questions about our styling irons, hair dryers, clippers, trimmers, and other tools. If the context is not in the knowledge base, respond with the fallback message: "Thank you for reaching out to StyleCraft support. We have received your inquiry and will review it shortly. A customer service representative will follow up with you." Do not invent or guess any facts, products, policies, or pricing details.',
      tone: 'Professional',
      greeting: 'Hello,',
      closing: 'Best regards,\nStyleCraft Support Team',
      autoReplyMode: 'DRAFT', // AI Draft -> Human Approval by default
      confidenceThreshold: 0.8,
    },
  });
  console.log('Created Settings for StyleCraft US');

  // 5. Create Inbox
  const inbox = await prisma.inbox.create({
    data: {
      name: 'StyleCraft Support Inbox',
      emailAddress: 'support@stylecraftus.com',
      provider: 'IMAP',
      credentials: JSON.stringify({ host: 'imap.gmail.com', port: 993, user: 'support@stylecraftus.com' }),
      status: 'CONNECTED',
      organizationId: org.id,
    },
  });
  console.log('Created Inbox:', inbox.emailAddress);
  
  console.log('Database seeding completed successfully. Clean StyleCraft US workspace initialized.');
}

main()
  .catch((e) => {
    console.error('Error during database seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    // Client disconnect
  });
