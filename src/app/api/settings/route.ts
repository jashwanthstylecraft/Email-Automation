import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const orgId = searchParams.get('orgId');

    if (!orgId) {
      return NextResponse.json({ error: 'Organization ID required' }, { status: 400 });
    }

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

    return NextResponse.json({ settings });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const {
      organizationId, systemPrompt, tone, greeting, closing,
      autoReplyMode, confidenceThreshold
    } = body;

    if (!organizationId) {
      return NextResponse.json({ error: 'Organization ID required' }, { status: 400 });
    }

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
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
