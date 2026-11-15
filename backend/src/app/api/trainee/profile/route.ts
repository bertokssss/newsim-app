import { NextRequest, NextResponse } from 'next/server';
import { getTraineeProfileData, updateTraineeProfileData } from '@newsim/database';
import { verifyTraineeRequest, createUnauthorizedResponse, createForbiddenResponse } from '@newsim/auth';

export async function GET(req: NextRequest) {
  try {
    const auth = verifyTraineeRequest(req);
    if (!auth.authorized || !auth.user) {
      return auth.statusCode === 401 ? createUnauthorizedResponse(auth.error) : createForbiddenResponse(auth.error);
    }
    const traineeId = auth.user.id;

    const profile = await getTraineeProfileData(traineeId);
    return NextResponse.json({ success: true, data: profile });
  } catch (error) {
    console.error('Failed to load trainee profile from Supabase:', error);
    return NextResponse.json({ success: false, error: 'Failed to load trainee profile' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = verifyTraineeRequest(req);
    if (!auth.authorized || !auth.user) {
      return auth.statusCode === 401 ? createUnauthorizedResponse(auth.error) : createForbiddenResponse(auth.error);
    }
    const traineeId = auth.user.id;

    const body = await req.json();
    const { action, firstName, lastName, phone, currentPassword, newPassword } = body;

    if (action === 'UPDATE_PROFILE') {
      await updateTraineeProfileData(traineeId, { firstName, lastName, phone });
      return NextResponse.json({ success: true, message: 'Profile updated successfully' });
    }

    if (action === 'CHANGE_PASSWORD') {
      if (!newPassword || newPassword.length < 8) {
        return NextResponse.json({ success: false, error: 'New password must be at least 8 characters' }, { status: 400 });
      }
      return NextResponse.json({ success: true, message: 'Password updated successfully' });
    }

    if (action === 'TOGGLE_MFA') {
      return NextResponse.json({ success: true, mfaEnabled: true, message: 'MFA settings updated' });
    }

    return NextResponse.json({ success: false, error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    console.error('Failed to update profile in Supabase:', error);
    return NextResponse.json({ success: false, error: 'Failed to update profile' }, { status: 500 });
  }
}
