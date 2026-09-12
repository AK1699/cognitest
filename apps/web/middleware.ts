import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const SESSION_COOKIE = 'cognitest_session';
const AUTH_PAGES = new Set(['/login', '/signup']);
const PUBLIC_PAGES = new Set([
  '/login',
  '/signup',
  '/verify-email',
  '/forgot-password',
  '/reset-password',
]);

/**
 * Optimistic UX gate only — it checks cookie presence, not validity. Real
 * enforcement is server-side in the API (AuthGuard + RLS).
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSession = request.cookies.has(SESSION_COOKIE);

  if (!hasSession && !PUBLIC_PAGES.has(pathname)) {
    const login = new URL('/login', request.url);
    if (pathname !== '/') login.searchParams.set('redirectTo', pathname);
    return NextResponse.redirect(login);
  }
  if (hasSession && AUTH_PAGES.has(pathname)) {
    return NextResponse.redirect(new URL('/', request.url));
  }
  return NextResponse.next();
}

export const config = {
  // everything except the API proxy, static assets and metadata files
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|ico)).*)'],
};
