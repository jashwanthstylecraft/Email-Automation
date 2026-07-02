import { prisma } from './prisma';
import { SessionUser } from './auth';

export interface AuditParams {
  action: string;
  user: SessionUser | null;
  entityType?: 'email' | 'template' | 'keyword' | 'note' | 'rule' | 'user';
  entityId?: string;
  beforeValue?: string | null;
  afterValue?: string | null;
  details: string;
  ipAddress?: string | null;
}

/** Writes one audit log entry, attributed to the acting user when known. */
export async function logAudit(params: AuditParams) {
  await prisma.auditLog.create({
    data: {
      action: params.action,
      userId: params.user?.id || null,
      userEmail: params.user?.email || null,
      entityType: params.entityType || null,
      entityId: params.entityId || null,
      beforeValue: params.beforeValue ?? null,
      afterValue: params.afterValue ?? null,
      ipAddress: params.ipAddress || null,
      details: params.details,
    },
  });
}
