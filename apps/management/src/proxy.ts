import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import {
  evaluateHttpsRedirect,
  buildSecurityHeaders,
  resolvePortalCookieSession,
} from '@newsim/utils';

const SUPER_ADMIN_ROLES = ['SUPER_ADMIN', 'SUPERADMIN'];
const ADMIN_ROLES = ['ADMIN', 'ADMINISTRATOR', 'SUPER_ADMIN', 'SUPERADMIN'];

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

  const isLegalPath =
    path.startsWith('/privacy') ||
    path.startsWith('/terms') ||
    path.startsWith('/auth/callback');
  if (isLegalPath) {
    return NextResponse.next();
  }

  const isPublicPath =
    path === '/login' ||
    path.startsWith('/login/') ||
    path === '/' ||
    path.startsWith('/forgot-password') ||
    path.startsWith('/reset-password') ||
    path.startsWith('/setup-password') ||
    path.startsWith('/verify-email');

  const isSuperAdminRoute = path.startsWith('/super-admin');
  const session = resolvePortalCookieSession(
    request.cookies,
    isSuperAdminRoute
      ? ['super_admin_session_token', 'session_token']
      : ['super_admin_session_token', 'admin_session_token', 'session_token'],
    isSuperAdminRoute ? SUPER_ADMIN_ROLES : ADMIN_ROLES,
    7
  );

  // Inactivity check for authorized management sessions
  if (session.token && session.isAuthorized && session.isInactive) {
    const response = NextResponse.redirect(new URL('/login?error=inactivity', request.url));
    if (session.cookieName) response.cookies.delete(session.cookieName);
    return response;
  }

  // 1. Authenticated Management user on login/public page -> redirect to appropriate dashboard
  if (isPublicPath) {
    if (session.token && session.isAuthorized && !hasErrorParam && path !== '/') {
      if (SUPER_ADMIN_ROLES.includes(session.role)) {
        return NextResponse.redirect(new URL('/super-admin/dashboard', request.url));
      }
      return NextResponse.redirect(new URL('/admin/dashboard', request.url));
    }
    return NextResponse.next();
  }

  // 2. Unauthenticated users trying to access protected dashboards
  if (!session.token) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // 3. Reject unauthorized roles on protected Management routes
  if (!session.isAuthorized) {
    if (isSuperAdminRoute && ADMIN_ROLES.includes(session.role)) {
      return NextResponse.redirect(new URL('/admin/dashboard', request.url));
    }
    return NextResponse.redirect(new URL('/login?error=unauthorized_portal', request.url));
  }

  // Keep Super Admins on the Super Admin portal instead of rendering a partial Admin sidebar
  if ((path === '/admin' || path.startsWith('/admin/')) && SUPER_ADMIN_ROLES.includes(session.role)) {
    return NextResponse.redirect(new URL('/super-admin/dashboard', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|icon\\.svg|icon\\.png|apple-icon\\.png|icons|images).*)',
  ],
};
