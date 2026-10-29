'use client';

import type { ReactNode } from 'react';

/** Centred dialog over a dimmed backdrop; clicking outside closes it. */
export function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="w-full max-w-md rounded-card border border-line bg-white p-6 shadow-xl"
      >
        <h2 className="mb-4 text-lg font-bold text-primary-deep">{title}</h2>
        {children}
      </div>
    </div>
  );
}
