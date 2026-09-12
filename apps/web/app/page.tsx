import { redirect } from 'next/navigation';

import { getMyOrganizations } from '../lib/api';

export const dynamic = 'force-dynamic';

/**
 * Logged-in landing router (middleware bounces anonymous visitors to /login):
 * a finished workspace goes to its dashboard, everything else to onboarding.
 */
export default async function HomePage() {
  const memberships = await getMyOrganizations();
  if (memberships === null) redirect('/login');

  const done = memberships.find((m) => m.organization.onboardingStatus === 'completed');
  if (done) redirect(`/${done.organization.id}/dashboard`);
  redirect('/onboarding');
}
