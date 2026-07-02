import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const userEmail = searchParams.get('userEmail');
    const action = searchParams.get('action');
    const entityType = searchParams.get('entityType');

    const where: any = {};
    if (userId) where.userId = userId;
    if (userEmail) where.userEmail = userEmail;
    if (action) where.action = action;
    if (entityType) where.entityType = entityType;

    const logs = await prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 300
    });

    const learningLogs = await prisma.learningLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100
    });

    return NextResponse.json({ logs, learningLogs });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
