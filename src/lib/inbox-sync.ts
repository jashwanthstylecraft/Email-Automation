import { prisma } from './prisma';
import { syncNewMockEmail } from './sync-service';
import { syncLiveIMAPEmail } from './live-sync-service';

/**
 * Runs one sync pass for an organization's primary inbox. Shared by the
 * manual "Sync Inbox" button (POST /api/inbox) and the scheduled cron sync
 * (GET /api/cron/sync), since Vercel's serverless runtime can't host the
 * always-on IMAP listener this app was originally built around.
 */
export async function syncOrgInbox(orgId: string) {
  const inbox = await prisma.inbox.findFirst({ where: { organizationId: orgId } });
  if (!inbox) {
    return { orgId, success: false, error: 'No configured inbox found' };
  }

  const hasLiveIMAP = !!(process.env.IMAP_USER && process.env.IMAP_PASSWORD && process.env.IMAP_HOST);

  if (hasLiveIMAP) {
    const result = await syncLiveIMAPEmail(inbox.id);
    return { orgId, success: true, isLive: true, ...result };
  }

  const result = await syncNewMockEmail(inbox.id);
  if (result.skipped) {
    return { orgId, success: true, isLive: false, syncedCount: 0, emails: [] };
  }
  return { orgId, success: true, isLive: false, syncedCount: 1, emails: [result.email] };
}
