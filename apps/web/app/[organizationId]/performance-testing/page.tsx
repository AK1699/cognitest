import type { Metadata } from 'next';

import { ComingSoon } from '../coming-soon';

export const metadata: Metadata = { title: 'Performance — Cognitest' };

export default function PerformanceTestingPage() {
  return (
    <ComingSoon
      title="Performance Testing"
      blurb="Load profiles, thresholds and trend reports. Execution permissions stay separate from read/write — running load is expensive by design."
    />
  );
}
