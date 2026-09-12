import { cookies } from 'next/headers';

const API_URL = process.env.API_URL ?? 'http://localhost:3001';

export interface MembershipSummary {
  membershipId: string;
  roleId: string | null;
  roleKey: string | null;
  memberStatus: string;
  organization: {
    id: string;
    name: string;
    slug: string;
    status: string;
    onboardingStatus: 'pending' | 'in_progress' | 'completed';
    onboardingStep: string | null;
  };
}

/** Server-component fetch against the API, forwarding the browser's cookies. */
export async function apiGet<T>(path: string): Promise<T | null> {
  const cookieHeader = (await cookies()).toString();
  try {
    const res = await fetch(`${API_URL}${path}`, {
      headers: cookieHeader ? { cookie: cookieHeader } : undefined,
      cache: 'no-store',
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export async function getMyOrganizations(): Promise<MembershipSummary[] | null> {
  const data = await apiGet<{ organizations: MembershipSummary[] }>('/users/me/organizations');
  return data?.organizations ?? null;
}
