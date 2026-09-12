import type { Metadata } from 'next';

import { ComingSoon } from '../coming-soon';

export const metadata: Metadata = { title: 'API Testing — Cognitest' };

export default function ApiTestingPage() {
  return (
    <ComingSoon
      title="API Testing"
      blurb="Collections, environments and assertion suites for your services — executed on demand or as part of a plan's approval pipeline."
    />
  );
}
