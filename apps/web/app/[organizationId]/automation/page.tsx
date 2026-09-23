import type { Metadata } from 'next';

import { ComingSoon } from '../coming-soon';

export const metadata: Metadata = { title: 'Automation — Cognitest' };

export default function AutomationPage() {
  return (
    <ComingSoon
      title="Automation"
      blurb="Web automation runs generated from your approved test plans, executed by desktop agents with live progress and evidence capture."
    />
  );
}
