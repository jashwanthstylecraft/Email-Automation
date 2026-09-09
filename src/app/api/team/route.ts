import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { prisma } from '@/lib/prisma';
import { getCurrentUser, isAdmin } from '@/lib/auth';
import { apiError } from '@/lib/api-error';

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const members = await prisma.user.findMany({
      where: { organizationId: user.organizationId },
      orderBy: { name: 'asc' },
    });

    return NextResponse.json({
      members: members.map((m) => ({
        id: m.id,
        name: m.name,
        email: m.email,
        role: m.role,
        createdAt: m.createdAt,
      })),
    });
  } catch (error: any) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser || !isAdmin(currentUser)) {
      return NextResponse.json({ error: 'Only an admin can create team accounts.' }, { status: 403 });
    }

    const body = await request.json();
    const { name, email, role } = body;
    // Always create in the acting admin's own org -- never trust a
    // client-supplied organizationId, or any admin could create an account
    // in a different organization entirely.
    const organizationId = currentUser.organizationId;

    if (!name || !email) {
      return NextResponse.json({ error: 'Name and email are required' }, { status: 400 });
    }

    const existing = await prisma.user.findUnique({
      where: { email },
    });

    if (existing) {
      return NextResponse.json({ error: 'User already exists' }, { status: 400 });
    }

    // A real, unique per-account password, not a hardcoded shared hash --
    // every account created via this route used to get the exact same
    // bcrypt hash, so anyone who knew (or found in source/git history) the
    // one plaintext it corresponds to could log in as ANY team member ever
    // created this way, in any org. Returned once so the admin can hand it
    // to the new team member; not recoverable after this response.
    const temporaryPassword = crypto.randomBytes(9).toString('base64url');
    const passwordHash = await bcrypt.hash(temporaryPassword, 10);

    const member = await prisma.user.create({
      data: {
        name,
        email,
        passwordHash,
        role: role || 'Support Agent',
        organizationId,
      },
    });

    return NextResponse.json({
      success: true,
      member: {
        id: member.id,
        name: member.name,
        email: member.email,
        role: member.role,
      },
      temporaryPassword,
    });
  } catch (error: any) {
    return apiError(error);
  }
}
