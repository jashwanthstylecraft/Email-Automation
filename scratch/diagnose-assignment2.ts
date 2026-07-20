import 'dotenv/config';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { PrismaPg } from '@prisma/adapter-pg';

async function main() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
  const prisma = new PrismaClient({ adapter });
  const orgId = '7d2fa089-98f9-43eb-9522-bd3d765d6bf8';
  const agents = await prisma.user.findMany({ where: { organizationId: orgId, role: 'Support Agent' }, orderBy: { createdAt: 'asc' } });
  for (const a of agents) {
    const open = await prisma.email.count({ where: { organizationId: orgId, assignedUserId: a.id, status: { in: ['UNREAD','WAITING'] } } });
    const total = await prisma.email.count({ where: { organizationId: orgId, assignedUserId: a.id } });
    console.log(a.name, a.id, 'open=', open, 'total=', total);
  }
  await prisma.$disconnect();
}
main();
