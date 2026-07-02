import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { prisma } from '../src/lib/prisma';

const TEMP_PASSWORD = 'StyleCraft@123';

const USERS = [
  { email: 'jashwanthd@stylecraftus.com', name: 'Jashwanth D', role: 'Admin' },
  { email: 'support1@stylecraftus.com', name: 'Support Agent 1', role: 'Support Agent' },
  { email: 'support2@stylecraftus.com', name: 'Support Agent 2', role: 'Support Agent' },
  { email: 'support3@stylecraftus.com', name: 'Support Agent 3', role: 'Support Agent' },
];

async function main() {
  const org = await prisma.organization.findFirst();
  if (!org) throw new Error('No organization found — run prisma/seed.ts first');

  const passwordHash = await bcrypt.hash(TEMP_PASSWORD, 10);

  for (const u of USERS) {
    const existing = await prisma.user.findUnique({ where: { email: u.email } });
    if (existing) {
      await prisma.user.update({
        where: { email: u.email },
        data: { passwordHash, role: u.role, name: u.name },
      });
      console.log(`Updated: ${u.email} (${u.role})`);
    } else {
      await prisma.user.create({
        data: { email: u.email, name: u.name, role: u.role, passwordHash, organizationId: org.id },
      });
      console.log(`Created: ${u.email} (${u.role})`);
    }
  }
  console.log(`\nAll accounts use temporary password: ${TEMP_PASSWORD}`);
}
main();
