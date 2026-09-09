import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser, isAdmin } from '@/lib/auth';
import { apiError } from '@/lib/api-error';

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    // Always scope to the caller's own org -- never trust a client-supplied
    // orgId, or any authenticated user could read another organization's AI
    // system prompt / auto-reply config just by passing a different id.
    const orgId = user.organizationId;

    let settings = await prisma.settings.findUnique({
      where: { organizationId: orgId },
    });

    if (!settings) {
      // Auto-create default settings if they don't exist
      settings = await prisma.settings.create({
        data: {
          organizationId: orgId,
          systemPrompt: 'You are a helpful customer support agent...',
          tone: 'Professional',
          greeting: 'Hello,',
          closing: 'Regards,\nSupport Team',
          autoReplyMode: 'DRAFT',
          confidenceThreshold: 0.8,
        },
      });
    }

    const inbox = await prisma.inbox.findFirst({
      where: { organizationId: orgId },
      select: { emailAddress: true, provider: true, status: true },
    });

    return NextResponse.json({ settings, inbox });
  } catch (error: any) {
    return apiError(error);
  }
}

export async function PUT(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user || !isAdmin(user)) {
      return NextResponse.json({ error: 'Only an admin can change organization settings.' }, { status: 403 });
    }

    const body = await request.json();
    const { systemPrompt, tone, greeting, closing, autoReplyMode, confidenceThreshold } = body;
    const organizationId = user.organizationId;

    const settings = await prisma.settings.upsert({
      where: { organizationId },
      update: {
        systemPrompt,
        tone,
        greeting,
        closing,
        autoReplyMode,
        confidenceThreshold: parseFloat(confidenceThreshold),
      },
      create: {
        organizationId,
        systemPrompt,
        tone,
        greeting,
        closing,
        autoReplyMode,
        confidenceThreshold: parseFloat(confidenceThreshold),
      },
    });

    return NextResponse.json({ success: true, settings });
  } catch (error: any) {
    return apiError(error);
  }
}
