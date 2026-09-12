'use client';

import { useRouter } from 'next/navigation';

export function LogoutButton() {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={() => {
        void fetch('/api/auth/logout', { method: 'POST' }).finally(() => {
          router.push('/login');
          router.refresh();
        });
      }}
      className="rounded-[10px] border border-line bg-white px-4 py-2 text-sm font-semibold text-ink transition-colors hover:bg-primary-tint"
    >
      Log out
    </button>
  );
}
