import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser, isAdmin, getClientIp } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { parseTemplatesFromWorkbook, applyTemplateImport, toSheetExportUrl } from '@/lib/template-import';
import { apiError } from '@/lib/api-error';

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user || !isAdmin(user)) {
      return NextResponse.json({ error: 'Only an admin can sync templates from the spreadsheet.' }, { status: 403 });
    }

    const settings = await prisma.settings.findUnique({ where: { organizationId: user.organizationId } });
    const sheetUrl = settings?.templateSheetUrl;
    if (!sheetUrl) {
      return NextResponse.json({ error: 'No template spreadsheet URL is configured in Settings yet.' }, { status: 400 });
    }

    const exportUrl = toSheetExportUrl(sheetUrl);
    const sheetRes = await fetch(exportUrl);
    if (!sheetRes.ok) {
      return NextResponse.json(
        { error: `Could not fetch the spreadsheet (status ${sheetRes.status}). Make sure it's shared as "Anyone with the link" (Viewer).` },
        { status: 502 }
      );
    }
    const buffer = Buffer.from(await sheetRes.arrayBuffer());
    const rows = parseTemplatesFromWorkbook(buffer);
    if (rows.length === 0) {
      return NextResponse.json({ error: 'No template rows found in the spreadsheet.' }, { status: 400 });
    }

    const { count } = await applyTemplateImport(user.organizationId, rows);

    await logAudit({
      action: 'TEMPLATES_SYNCED_FROM_SHEET',
      user,
      entityType: 'template',
      ipAddress: getClientIp(request),
      details: `${user.email} synced ${count} template(s) from the linked spreadsheet, replacing all previous templates and rules`,
    });

    return NextResponse.json({ success: true, count });
  } catch (error: any) {
    return apiError(error);
  }
}
