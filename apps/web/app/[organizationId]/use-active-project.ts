'use client';

import { useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

interface ProjectLike {
  id: string;
  status: string;
}

const EVENT = 'cognitest:active-project';
const storageKey = (organizationId: string) => `cognitest-active-project:${organizationId}`;

/**
 * The active project, shared by the breadcrumb, workspace dropdown and
 * Projects page. Precedence: URL ?project= (inside Design) → the selection
 * stored per organisation → first active project. Selecting stores and
 * broadcasts, so every mounted consumer updates immediately.
 */
export function useActiveProject<T extends ProjectLike>(
  organizationId: string,
  projects: T[],
): [T | null, (projectId: string) => void] {
  const searchParams = useSearchParams();
  const urlId = searchParams.get('project');
  const [storedId, setStoredId] = useState<string | null>(null);

  useEffect(() => {
    const read = () => setStoredId(localStorage.getItem(storageKey(organizationId)));
    read();
    window.addEventListener(EVENT, read);
    window.addEventListener('storage', read); // other tabs
    return () => {
      window.removeEventListener(EVENT, read);
      window.removeEventListener('storage', read);
    };
  }, [organizationId]);

  const setActive = useCallback(
    (projectId: string) => {
      localStorage.setItem(storageKey(organizationId), projectId);
      window.dispatchEvent(new Event(EVENT));
    },
    [organizationId],
  );

  const active =
    projects.find((p) => p.id === urlId) ??
    projects.find((p) => p.id === storedId) ??
    projects.find((p) => p.status === 'active') ??
    projects[0] ??
    null;

  return [active, setActive];
}
