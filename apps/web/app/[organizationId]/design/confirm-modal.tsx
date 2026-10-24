'use client';

import { Modal } from '../modal';
import { ghostButton } from './design-ui';

const dangerButton =
  'inline-flex items-center justify-center gap-1.5 rounded-[10px] bg-fail px-3.5 py-2 text-sm font-bold text-white transition-colors hover:brightness-110 disabled:opacity-60';

/** A themed confirmation dialog, used for destructive actions across Design. */
export function ConfirmModal({
  title,
  message,
  confirmLabel = 'Delete',
  onConfirm,
  onClose,
}: {
  title: string;
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Modal title={title} onClose={onClose}>
      <p className="text-sm text-muted">{message}</p>
      <div className="mt-5 flex justify-end gap-2">
        <button type="button" onClick={onClose} className={ghostButton}>
          Cancel
        </button>
        <button type="button" onClick={onConfirm} className={dangerButton}>
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
