import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@newsim/database';
import { verifySuperAdminRequestAsync, createUnauthorizedResponse, createForbiddenResponse } from '@newsim/auth';
import { hasModulePermission } from '@newsim/utils';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const auth = await verifySuperAdminRequestAsync(request);

  if (!auth.authorized || !auth.user) {
    return auth.statusCode === 401
      ? createUnauthorizedResponse(auth.error)
      : createForbiddenResponse(auth.error);
  }

  const perms = auth.user.permissions || [];

  try {
    const [
      { count: adminCount },
      { count: instructorCount },
      { count: traineeCount },
    ] = await Promise.all([
      hasModulePermission(perms, 'ADMIN_VIEW', 'SUPER_ADMIN')
        ? supabaseAdmin.from('profiles').select('*', { count: 'exact', head: true }).in('role', ['ADMIN', 'admin'])
        : Promise.resolve({ count: 0 }),
      hasModulePermission(perms, 'INSTRUCTOR_VIEW', 'SUPER_ADMIN')
        ? supabaseAdmin.from('profiles').select('*', { count: 'exact', head: true }).in('role', ['INSTRUCTOR', 'instructor'])
        : Promise.resolve({ count: 0 }),
      hasModulePermission(perms, 'TRAINEE_VIEW', 'SUPER_ADMIN')
        ? supabaseAdmin.from('profiles').select('*', { count: 'exact', head: true }).in('role', ['TRAINEE', 'trainee'])
        : Promise.resolve({ count: 0 }),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        admins: adminCount || 0,
        instructors: instructorCount || 0,
        trainees: traineeCount || 0,
        permissions: perms,
      },
    });
  } catch (error) {
    console.error('Failed to get super-admin sidebar counts:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
