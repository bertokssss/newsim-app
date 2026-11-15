import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@newsim/auth';

export async function GET(req: NextRequest) {
  try {
    const session = getSessionFromRequest(req);
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { activeUser, sessionId } = session;

    return NextResponse.json({
      success: true,
      user: {
        id: activeUser.id,
        email: activeUser.email,
        username: activeUser.username,
        role: activeUser.role,
        status: activeUser.status,
        firstName: activeUser.firstName,
        lastName: activeUser.lastName,
        department: activeUser.department,
        mfaEnabled: activeUser.mfaEnabled,
        lastLoginAt: activeUser.lastLoginAt,
        permissions: activeUser.permissions || [],
        sessionId,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: 'Failed to retrieve current user.' },
      { status: 500 }
    );
  }
}
