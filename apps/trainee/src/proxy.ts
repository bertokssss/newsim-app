import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import {
  evaluateHttpsRedirect,
  buildSecurityHeaders,
  resolvePortalCookieSession,
} from '@newsim/utils';

const TRAINEE_PORTAL_ROLES = ['TRAINEE', 'STUDENT'];

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
  const hasErrorParam =
    searchParams.has('error') ||
    searchParams.has('message') ||
    searchParams.has('google_match');

  // Legal pages and OAuth callbacks must pass straight through without session interception
  if (
    path.startsWith('/privacy') ||
    path.startsWith('/terms') ||
    path.startsWith('/auth/callback')
  ) {
    return NextResponse.next();
  }

  // Forward OAuth callbacks (?code=...) that land on `/` or `/login` (e.g. Site URL fallback)
  if ((path === '/' || path === '/login') && searchParams.has('code')) {
    const callbackUrl = new URL('/auth/callback', request.nextUrl);
    searchParams.forEach((value, key) => {
      callbackUrl.searchParams.set(key, value);
    });
    return NextResponse.redirect(callbackUrl);
  }

  // Prioritize trainee-specific cookie so other localhost portals never hijack or evict an active Trainee session.
  const session = resolvePortalCookieSession(
    request.cookies,
    ['trainee_session_token', 'session_token'],
    TRAINEE_PORTAL_ROLES,
    30
  );

  // Inactivity check: Remember Me session exceeded 30 days of inactivity
  if (session.token && session.isAuthorized && session.isInactive) {
    const response = NextResponse.redirect(new URL('/login?error=inactivity', request.nextUrl));
    response.cookies.delete('trainee_session_token');
    return response;
  }

  const isPublicPath =
    path === '/login' ||
    path === '/' ||
    path.startsWith('/register') ||
    path.startsWith('/forgot-password') ||
    path.startsWith('/reset-password') ||
    path.startsWith('/verify-email');

  if (path === '/') {
    if (session.token && session.isAuthorized) {
      return NextResponse.redirect(new URL('/dashboard', request.nextUrl));
    }
    const loginUrl = new URL('/login', request.nextUrl);
    if (searchParams.has('error')) {
      searchParams.forEach((value, key) => loginUrl.searchParams.set(key, value));
    }
    return NextResponse.redirect(loginUrl);
  }

  // 1. Authenticated Trainee on public page (e.g. /login) without an error parameter -> go to dashboard
  if (isPublicPath) {
    if (session.token && session.isAuthorized && !hasErrorParam) {
      return NextResponse.redirect(new URL('/dashboard', request.nextUrl));
    }
    return NextResponse.next();
  }

  // 2. Unauthenticated user trying to access protected Trainee pages
  if (!session.token) {
    return NextResponse.redirect(new URL('/login', request.nextUrl));
  }

  // 3. User with mismatched role trying to access Trainee protected route
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
