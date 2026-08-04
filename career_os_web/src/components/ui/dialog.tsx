import { Modal } from '@mantine/core';
import type { ReactNode } from 'react';

const DIALOG_CLASS_NAMES = {
  overlay: 'backdrop-blur-sm',
  content:
    'overflow-hidden rounded-2xl border border-black/10 bg-white shadow-xl',
  header: 'border-b border-black/6 bg-white px-6 py-4',
  title: 'text-lg font-bold tracking-tight text-foreground',
  body: 'bg-white p-6',
  close:
    'rounded-lg text-gray-600 hover:bg-black/5 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
} as const;

interface DialogProps {
  children: ReactNode;
  onClose: () => void;
  opened: boolean;
  title: string;
}

/**
 * Project-level modal dialog boundary.
 *
 * Mantine owns the overlay lifecycle (focus trap, Escape handling, scroll lock,
 * and focus restoration). Callers own only the dialog content and therefore
 * cannot omit the accessible title or disable those behaviors.
 */
export function Dialog({ children, onClose, opened, title }: DialogProps) {
  return (
    <Modal
      centered
      classNames={DIALOG_CLASS_NAMES}
      closeButtonProps={{ 'aria-label': '대화상자 닫기' }}
      onClose={onClose}
      opened={opened}
      title={title}
    >
      {children}
    </Modal>
  );
}
