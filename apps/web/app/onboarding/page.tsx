import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { getMyOrganizations } from '../../lib/api';
import { OnboardingWizard } from './onboarding-wizard';

export const metadata: Metadata = { title: 'Set up your workspace — Cognitest' };
export const dynamic = 'force-dynamic';

/**
 * Wizard entry with resume: an admin org whose onboarding is unfinished
 * continues at its recorded step; a finished org goes straight to its
 * dashboard; otherwise the wizard starts from scratch.
 */
export default async function OnboardingPage() {
  const memberships = (await getMyOrganizations()) ?? [];

  const unfinished = memberships.find(
    (m) => m.roleKey === 'admin' && m.organization.onboardingStatus !== 'completed',
  );
  if (!unfinished) {
    const done = memberships.find((m) => m.organization.onboardingStatus === 'completed');
    if (done) redirect(`/${done.organization.id}/dashboard`);
  }

  const initialStep = unfinished?.organization.onboardingStep === 'invite' ? 'invite' : 'team';

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 p-6">
      <span className="font-display text-3xl font-bold tracking-tight text-primary-deep">
        Cognitest
      </span>
      <OnboardingWizard
        initialOrganization={
          unfinished
            ? { id: unfinished.organization.id, name: unfinished.organization.name }
            : null
        }
        initialStep={unfinished ? initialStep : 'organization'}
      />
    </main>
  );
}
