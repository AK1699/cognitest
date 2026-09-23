import type { Metadata } from 'next';

import { ComingSoon } from '../coming-soon';

export const metadata: Metadata = { title: 'Security — Cognitest' };

export default function SecurityTestingPage() {
  return (
    <ComingSoon
      title="Security Testing"
      blurb="Scan configurations and findings triage for your targets, gated by the dedicated security.execute permission."
    />
  );
}
