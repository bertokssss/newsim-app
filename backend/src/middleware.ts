import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:3002',
  'http://localhost:3003',
  'http://localhost:4000',
  'https://management.newsim.com',
  'https://instructor.newsim.com',
  'https://trainee.newsim.com',
  'https://api.newsim.com',
];

function isOriginAllowed(origin: string | null): boolean {
  if (!origin) return false;
  if (ALLOWED_ORIGINS.includes(origin) || origin.endsWith('.newsim.com')) return true;
  // Allow local LAN IPs in development/testing (192.168.x.x, 10.x.x.x, 172.16-31.x.x, .local, .lan)
  const isLocalNetwork = /^https?:\/\/(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+|[a-zA-Z0-9-]+\.(local|lan))(:\d+)?$/.test(origin);
  return isLocalNetwork;
}

export function middleware(request: NextRequest) {
  const origin = request.headers.get('origin');
  const isAllowedOrigin = isOriginAllowed(origin);

  // Handle preflight OPTIONS request
  if (request.method === 'OPTIONS') {
    const response = new NextResponse(null, { status: 204 });
    if (isAllowedOrigin && origin) {
      response.headers.set('Access-Control-Allow-Origin', origin);
      response.headers.set('Access-Control-Allow-Credentials', 'true');
      response.headers.set(
        'Access-Control-Allow-Methods',
        'GET, POST, PUT, DELETE, PATCH, OPTIONS'
      );
      response.headers.set(
        'Access-Control-Allow-Headers',
        'Content-Type, Authorization, X-Requested-With, Cookie'
      );
      response.headers.set('Access-Control-Max-Age', '86400');
    }
    return response;
  }

  // Normal request handling
  const response = NextResponse.next();
  if (isAllowedOrigin && origin) {
    response.headers.set('Access-Control-Allow-Origin', origin);
    response.headers.set('Access-Control-Allow-Credentials', 'true');
    response.headers.set(
      'Access-Control-Allow-Methods',
      'GET, POST, PUT, DELETE, PATCH, OPTIONS'
    );
    response.headers.set(
      'Access-Control-Allow-Headers',
      'Content-Type, Authorization, X-Requested-With, Cookie'
    );
  }

  return response;
}

export const config = {
  matcher: ['/api/:path*'],
};
