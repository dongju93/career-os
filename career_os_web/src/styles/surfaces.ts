import * as stylex from '@stylexjs/stylex';
export const surfaces = stylex.create({
  glass: {
    backgroundImage:
      'linear-gradient( 135deg, rgba(255, 255, 255, 0.85) 0%, rgba(255, 255, 255, 0.6) 100% )',
    backdropFilter: 'blur(20px) saturate(120%)',
    boxShadow:
      '0 2px 16px rgba(0, 0, 0, 0.06), inset 0 1px 0 rgba(255, 255, 255, 0.6)',
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: 'rgba(0, 0, 0, 0.06)',
  },
  glassStrong: {
    backgroundImage:
      'linear-gradient( 180deg, rgba(255, 255, 255, 0.95) 0%, rgba(255, 255, 255, 0.75) 100% )',
    backdropFilter: 'blur(24px) saturate(120%)',
    boxShadow:
      '0 4px 24px rgba(0, 0, 0, 0.06), inset 0 1px 0 rgba(255, 255, 255, 0.7)',
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: 'rgba(0, 0, 0, 0.06)',
  },
  glassLight: {
    backdropFilter: 'blur(12px) saturate(120%)',
    boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.5)',
    backgroundColor: 'rgba(255, 255, 255, 0.55)',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: 'rgba(0, 0, 0, 0.04)',
  },
  glassHover: {
    backgroundImage: {
      default:
        'linear-gradient(135deg, rgba(255,255,255,0.85), rgba(255,255,255,0.6))',
      ':hover':
        'linear-gradient( 135deg, rgba(255, 255, 255, 0.95) 0%, rgba(255, 255, 255, 0.65) 100% )',
    },
    borderColor: {
      default: 'rgba(0, 0, 0, 0.06)',
      ':hover': 'rgba(0, 0, 0, 0.1)',
    },
    boxShadow: {
      default:
        '0 2px 16px rgba(0,0,0,0.06), inset 0 1px 0 rgba(255,255,255,0.6)',
      ':hover':
        '0 6px 24px rgba(0, 0, 0, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.7)',
    },
    transform: {
      default: null,
      ':hover': {
        default: 'translateY(-2px)',
        '@media (prefers-reduced-motion: reduce)': 'none',
      },
    },
    backgroundColor: {
      default: 'rgba(255,255,255,0.7)',
      ':hover': 'rgba(255, 255, 255, 0.8)',
    },
    transitionProperty: 'transform, box-shadow, background-color',
    transitionDuration: '250ms, 300ms, 250ms',
    transitionTimingFunction: 'ease',
  },
  surface: {
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.05)',
    backgroundColor: 'rgba(255, 255, 255, 0.75)',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: 'rgba(0, 0, 0, 0.06)',
  },
  btnPrimary: {
    color: '#fff',
    fontWeight: '700',
    boxShadow: {
      default:
        '0 1px 2px rgba(0, 0, 0, 0.08), 0 2px 8px rgba(6, 182, 212, 0.2)',
      ':hover':
        '0 1px 2px rgba(0, 0, 0, 0.08), 0 4px 12px rgba(6, 182, 212, 0.3)',
    },
    backgroundImage: {
      default: 'linear-gradient(135deg, hsl(185 72% 40%), hsl(185 68% 34%))',
      ':hover': 'linear-gradient(135deg, hsl(185 72% 44%), hsl(185 68% 38%))',
    },
    borderWidth: 0,
    borderStyle: 'none',
  },
  btnSecondary: {
    color: 'hsl(var(--foreground))',
    boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.4)',
    borderColor: {
      default: 'rgba(0, 0, 0, 0.1)',
      ':hover': 'rgba(0, 0, 0, 0.16)',
    },
    backgroundColor: {
      default: 'rgba(0, 0, 0, 0.04)',
      ':hover': 'rgba(0, 0, 0, 0.07)',
    },
    borderWidth: '1px',
    borderStyle: 'solid',
  },
  btnGhost: {
    color: {
      default: 'hsl(var(--muted-foreground))',
      ':hover': 'hsl(var(--foreground))',
    },
    backgroundColor: {
      default: 'transparent',
      ':hover': 'rgba(0, 0, 0, 0.04)',
    },
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: 'transparent',
  },
  inputClean: {
    color: 'hsl(var(--foreground))',
    boxShadow: {
      default: 'inset 0 1px 2px rgba(0, 0, 0, 0.04)',
      ':focus':
        '0 0 0 3px hsl(var(--primary) / 0.1), inset 0 1px 2px rgba(0, 0, 0, 0.04)',
    },
    '::placeholder': {
      color: 'hsl(var(--muted-foreground))',
    },
    borderColor: {
      default: 'rgba(0, 0, 0, 0.1)',
      ':hover': 'rgba(0, 0, 0, 0.16)',
      ':focus': 'hsl(var(--primary) / 0.5)',
    },
    backgroundColor: {
      default: 'rgba(0, 0, 0, 0.03)',
      ':focus': 'rgba(0, 0, 0, 0.04)',
    },
    borderWidth: '1px',
    borderStyle: 'solid',
  },
});
