'use client';

import { useState } from 'react';
import type { ReactNode } from 'react';

const TABS = ['Information', 'Integrations', 'Security'] as const;
type Tab = (typeof TABS)[number];

export function ProfileTabs({
  information,
  integrations,
  security,
}: {
  information: ReactNode;
  integrations: ReactNode;
  security: ReactNode;
}) {
  const [tab, setTab] = useState<Tab>('Information');
  const panels: Record<Tab, ReactNode> = {
    Information: information,
    Integrations: integrations,
    Security: security,
  };

  return (
    <div className="max-w-2xl">
      <div role="tablist" className="mb-6 flex gap-6 border-b border-line">
        {TABS.map((name) => {
          const active = tab === name;
          return (
            <button
              key={name}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setTab(name)}
              className={`-mb-px border-b-2 pb-2.5 text-sm font-semibold transition-colors ${
                active
                  ? 'border-primary text-primary-deep'
                  : 'border-transparent text-muted hover:text-ink'
              }`}
            >
              {name}
            </button>
          );
        })}
      </div>
      <div role="tabpanel" className="rounded-card border border-line bg-white p-6">
        {panels[tab]}
      </div>
    </div>
  );
}
