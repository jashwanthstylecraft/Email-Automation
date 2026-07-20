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
    const orgs = await prisma.organization.findMany({ select: { id: true, name: true } });
    console.log('Organizations:', orgs);

    for (const org of orgs) {
      console.log(`\n=== Org: ${org.name} (${org.id}) ===`);

      const total = await prisma.email.count({ where: { organizationId: org.id } });
      console.log('Total emails:', total);

      const byAssignee = await prisma.email.groupBy({
        by: ['assignedUserId'],
        where: { organizationId: org.id },
        _count: { id: true },
      });
      console.log('By assignedUserId (null = unassigned):', byAssignee.map(g => ({ assignedUserId: g.assignedUserId, count: g._count.id })));

      const byStatus = await prisma.email.groupBy({
        by: ['status'],
        where: { organizationId: org.id },
        _count: { id: true },
      });
      console.log('By status:', byStatus.map(g => ({ status: g.status, count: g._count.id })));

      // Cross-tab: status x assigned/unassigned
      const crossTab = await prisma.email.groupBy({
        by: ['status', 'assignedUserId'],
        where: { organizationId: org.id },
        _count: { id: true },
      });
      console.log('Status x assignedUserId:', crossTab.map(g => ({ status: g.status, assignedUserId: g.assignedUserId, count: g._count.id })));

      const users = await prisma.user.findMany({
        where: { organizationId: org.id },
        select: { id: true, name: true, email: true, role: true, lastSeenAt: true, createdAt: true },
        orderBy: { createdAt: 'asc' },
      });
      console.log('Users:');
      for (const u of users) {
        const isActive = u.lastSeenAt ? (Date.now() - u.lastSeenAt.getTime() < 10 * 60 * 1000) : false;
        console.log(`  - ${u.name} <${u.email}> role=${u.role} lastSeenAt=${u.lastSeenAt} activeNow=${isActive}`);
      }

      const assignmentLogCount = await prisma.assignmentLog.count({ where: { email: { organizationId: org.id } } });
      console.log('Total AssignmentLog rows:', assignmentLogCount);
      const byMethod = await prisma.assignmentLog.groupBy({
        by: ['assignmentMethod'],
        where: { email: { organizationId: org.id } },
        _count: { id: true },
      });
      console.log('AssignmentLog by method:', byMethod.map(g => ({ method: g.assignmentMethod, count: g._count.id })));

      const oldestEmail = await prisma.email.findFirst({ where: { organizationId: org.id }, orderBy: { createdAt: 'asc' }, select: { createdAt: true } });
      const newestEmail = await prisma.email.findFirst({ where: { organizationId: org.id }, orderBy: { createdAt: 'desc' }, select: { createdAt: true } });
      console.log('Oldest email createdAt:', oldestEmail?.createdAt, ' Newest email createdAt:', newestEmail?.createdAt);
    }
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
