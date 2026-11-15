import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcrypt';
import { db } from '@newsim/database';

export async function GET(req: NextRequest) {
  try {
    const instructor = db.getUserById('usr-ins-01');

    return NextResponse.json({
      success: true,
      data: {
        id: instructor?.id,
        firstName: instructor?.firstName,
        lastName: instructor?.lastName,
        email: instructor?.email,
        username: instructor?.username,
        phone: instructor?.phone,
        specialization: instructor?.specialization,
        employeeId: instructor?.employeeId,
        assignedCenterId: instructor?.assignedCenterId,
        mfaEnabled: instructor?.mfaEnabled,
        lastLoginAt: instructor?.lastLoginAt,
        status: instructor?.status,
        permissions: [
          'COURSE_VIEW_ASSIGNED',
          'TRAINEE_VIEW_ASSIGNED',
          'ASSESSMENT_VIEW_ASSIGNED',
          'ASSESSMENT_GRADE',
          'GRADE_VIEW',
          'GRADE_UPDATE',
          'ATTENDANCE_VIEW',
          'ATTENDANCE_CREATE',
          'PROGRESS_VIEW',
          'MATERIAL_VIEW',
          'MATERIAL_UPLOAD',
          'SCHEDULE_VIEW',
          'NOTIFICATION_VIEW',
          'PROFILE_VIEW',
          'PROFILE_UPDATE',
        ],
      },
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to load profile' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, firstName, lastName, phone, currentPassword, newPassword } = body;

    const instructor = db.getUserById('usr-ins-01');
    if (!instructor) {
      return NextResponse.json({ success: false, error: 'Instructor not found' }, { status: 404 });
    }

    if (action === 'UPDATE_PROFILE') {
      db.updateUser(instructor.id, {
        firstName: firstName || instructor.firstName,
        lastName: lastName || instructor.lastName,
        phone: phone || instructor.phone,
      });

      db.addAuditLog({
        actorEmail: instructor.email,
        actorRole: 'INSTRUCTOR',
        action: 'PROFILE_UPDATED',
        targetType: 'USER',
        targetId: instructor.id,
        details: { firstName, lastName, phone },
        ipAddress: '127.0.0.1',
        userAgent: 'NEWSIM Instructor Portal',
        status: 'SUCCESS',
        severity: 'INFO',
      });

      return NextResponse.json({ success: true, message: 'Profile updated successfully' });
    }

    if (action === 'CHANGE_PASSWORD') {
      if (!currentPassword || !newPassword) {
        return NextResponse.json({ success: false, error: 'Current and new passwords are required' }, { status: 400 });
      }

      if (newPassword.length < 8) {
        return NextResponse.json({ success: false, error: 'New password must be at least 8 characters long' }, { status: 400 });
      }

      const match = await bcrypt.compare(currentPassword, instructor.passwordHash);
      if (!match) {
        return NextResponse.json({ success: false, error: 'Current password is incorrect' }, { status: 400 });
      }

      const newHash = await bcrypt.hash(newPassword, 10);
      db.updateUser(instructor.id, { passwordHash: newHash });

      db.addAuditLog({
        actorEmail: instructor.email,
        actorRole: 'INSTRUCTOR',
        action: 'PASSWORD_CHANGED',
        targetType: 'USER',
        targetId: instructor.id,
        details: { method: 'INSTRUCTOR_PROFILE' },
        ipAddress: '127.0.0.1',
        userAgent: 'NEWSIM Instructor Portal',
        status: 'SUCCESS',
        severity: 'INFO',
      });

      return NextResponse.json({ success: true, message: 'Password changed successfully' });
    }

    if (action === 'TOGGLE_MFA') {
      const updated = db.updateUser(instructor.id, { mfaEnabled: !instructor.mfaEnabled });

      db.addAuditLog({
        actorEmail: instructor.email,
        actorRole: 'INSTRUCTOR',
        action: 'MFA_SETTINGS_CHANGED',
        targetType: 'USER',
        targetId: instructor.id,
        details: { mfaEnabled: updated?.mfaEnabled },
        ipAddress: '127.0.0.1',
        userAgent: 'NEWSIM Instructor Portal',
        status: 'SUCCESS',
        severity: 'INFO',
      });

      return NextResponse.json({ success: true, mfaEnabled: updated?.mfaEnabled });
    }

    return NextResponse.json({ success: false, error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to update profile' }, { status: 500 });
  }
}
