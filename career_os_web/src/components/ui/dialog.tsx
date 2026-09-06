import { Modal } from '@mantine/core';
import * as stylex from '@stylexjs/stylex';
import type { ReactNode } from 'react';

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

const styles = stylex.create({
  overlay: {
    backdropFilter: 'blur(8px)',
  },
  content: {
    overflow: 'hidden',
    borderRadius: '1rem',
    borderWidth: '1px',
    borderColor: 'color-mix(in oklab, #000 10%, transparent)',
    backgroundColor: '#fff',
    boxShadow:
      '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
  },
  header: {
    borderBottomWidth: '1px',
    borderColor: 'color-mix(in oklab, #000 6%, transparent)',
    backgroundColor: '#fff',
    paddingLeft: '1.5rem',
    paddingRight: '1.5rem',
    paddingTop: '1rem',
    paddingBottom: '1rem',
  },
  title: {
    fontSize: '1.125rem',
    lineHeight: '1.75rem',
    fontWeight: 700,
    letterSpacing: '-.025em',
    color: 'hsl(var(--foreground))',
  },
  body: {
    backgroundColor: '#fff',
    paddingTop: '1.5rem',
    paddingRight: '1.5rem',
    paddingBottom: '1.5rem',
    paddingLeft: '1.5rem',
  },
  close: {
    borderRadius: '.5rem',
    color: {
      default: 'oklch(44.6% .03 256.802)',
      ':hover': 'hsl(var(--foreground))',
    },
    backgroundColor: {
      default: null,
      ':hover': 'color-mix(in oklab, #000 5%, transparent)',
    },
    outlineStyle: {
      default: null,
      ':focus-visible': 'solid',
    },
    outlineWidth: {
      default: null,
      ':focus-visible': '2px',
    },
    outlineColor: {
      default: null,
      ':focus-visible': 'hsl(var(--ring))',
    },
    outlineOffset: {
      default: null,
      ':focus-visible': '0px',
    },
  },
});

const DIALOG_CLASS_NAMES = {
  overlay: stylex.props(styles.overlay).className,
  content: stylex.props(styles.content).className,
  header: stylex.props(styles.header).className,
  title: stylex.props(styles.title).className,
  body: stylex.props(styles.body).className,
  close: stylex.props(styles.close).className,
} as const;
