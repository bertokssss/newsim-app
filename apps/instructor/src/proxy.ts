import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import {
  evaluateHttpsRedirect,
  buildSecurityHeaders,
  resolvePortalCookieSession,
} from '@newsim/utils';

const INSTRUCTOR_PORTAL_ROLES = ['INSTRUCTOR', 'TEACHER', 'TRAINER', 'SUPER_ADMIN', 'SUPERADMIN'];

function finalizeResponse(res: NextResponse, isHttps: boolean): NextResponse {
  const secHeaders = buildSecurityHeaders({ isHttps });
  for (const [k, v] of Object.entries(secHeaders)) {
    res.headers.set(k, v);
  }
  return res;
}

export function proxy(request: NextRequest) {
  const httpsCheck = evaluateHttpsRedirect(request.url, request.headers);
  if (httpsCheck.shouldRedirect) {
    return NextResponse.redirect(httpsCheck.redirectUrl, 308);
  }
  if (request.nextUrl.pathname.startsWith('/api')) {
    return finalizeResponse(NextResponse.next(), httpsCheck.isHttps);
  }
  const response = handleProxy(request);
  return finalizeResponse(response, httpsCheck.isHttps);
}

function handleProxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const searchParams = request.nextUrl.searchParams;
  const hasErrorParam = searchParams.has('error') || searchParams.has('message');

  if (path.startsWith('/privacy') || path.startsWith('/terms')) {
    return NextResponse.next();
  }

  // Prioritize instructor-specific cookie so other localhost portals never hijack or evict an active Instructor session.
  const session = resolvePortalCookieSession(
    request.cookies,
    ['instructor_session_token', 'session_token'],
    INSTRUCTOR_PORTAL_ROLES,
    7
  );

  // Inactivity check: Remember Me session exceeded 7 days of inactivity
  if (session.token && session.isAuthorized && session.isInactive) {
    const response = NextResponse.redirect(new URL('/login?error=inactivity', request.nextUrl));
    response.cookies.delete('instructor_session_token');
    return response;
  }

  const isPublicPath =
    path === '/login' ||
    path === '/' ||
    path.startsWith('/forgot-password') ||
    path.startsWith('/reset-password') ||
    path.startsWith('/verify-email');

  if (path === '/') {
    if (session.token && session.isAuthorized) {
      return NextResponse.redirect(new URL('/dashboard', request.nextUrl));
    }
    return NextResponse.redirect(new URL('/login', request.nextUrl));
  }

  // 1. Authenticated Instructor on public page (e.g. /login) without an error parameter -> go to dashboard
  if (isPublicPath) {
    if (session.token && session.isAuthorized && !hasErrorParam) {
      return NextResponse.redirect(new URL('/dashboard', request.nextUrl));
    }
    return NextResponse.next();
  }

  // 2. Unauthenticated user trying to access protected Instructor pages
  if (!session.token) {
    return NextResponse.redirect(new URL('/login', request.nextUrl));
  }

  // 3. User with mismatched role (no authorized Instructor session) trying to access Instructor protected route
  if (!session.isAuthorized) {
    return NextResponse.redirect(new URL('/login?error=unauthorized_portal', request.nextUrl));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|icon\\.svg|icon\\.png|apple-icon\\.png|icons|images).*)',
  ],
};
