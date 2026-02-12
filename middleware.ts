import { NextRequest, NextResponse } from 'next/server';

function isAuthorized(req: NextRequest): boolean {
  const auth = req.headers.get('authorization') ?? '';
  if (!auth.startsWith('Basic ')) return false;

  const base64 = auth.slice(6);
  const decoded = Buffer.from(base64, 'base64').toString('utf-8');
  const colonIdx = decoded.indexOf(':');
  if (colonIdx === -1) return false;
  const user = decoded.slice(0, colonIdx);
  const pass = decoded.slice(colonIdx + 1);

  return (
    user === process.env.ADMIN_USER &&
    pass === process.env.ADMIN_PASS &&
    !!process.env.ADMIN_USER &&
    !!process.env.ADMIN_PASS
  );
}

export function middleware(req: NextRequest) {
  if (!isAuthorized(req)) {
    return new NextResponse('Unauthorized', {
      status: 401,
      headers: {
        'WWW-Authenticate': 'Basic realm="RangerWatch Admin"',
      },
    });
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*', '/api/admin/:path*'],
};
