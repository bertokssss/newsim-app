import { NextRequest, NextResponse } from 'next/server';
import { verifyInstructorRequestAsync, createUnauthorizedResponse, createForbiddenResponse } from '@newsim/auth';

export async function requireInstructor(
  req: NextRequest,
  requiredPermission?: string
): Promise<
  | { authorized: true; instructorId: string; permissions: string[] }
  | { authorized: false; response: NextResponse }
> {
  const auth = await verifyInstructorRequestAsync(req, requiredPermission);
  if (!auth.authorized || !auth.user) {
    const response =
      auth.statusCode === 403
        ? createForbiddenResponse(auth.error)
        : createUnauthorizedResponse(auth.error);
    return { authorized: false, response };
  }
  return {
    authorized: true,
    instructorId: auth.user.id,
    permissions: auth.user.permissions || [],
  };
}
