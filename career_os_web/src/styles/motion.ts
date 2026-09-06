import * as stylex from '@stylexjs/stylex';

const reduceMotion = '@media (prefers-reduced-motion: reduce)';
const fadeIn = stylex.keyframes({
  from: { opacity: 0, transform: 'translateY(12px)' },
  to: { opacity: 1, transform: 'translateY(0)' },
});
const slideIn = stylex.keyframes({
  from: { opacity: 0, transform: 'translateX(-12px)' },
  to: { opacity: 1, transform: 'translateX(0)' },
});
const softFade = stylex.keyframes({ from: { opacity: 0 }, to: { opacity: 1 } });
const pulse = stylex.keyframes({ '50%': { opacity: 0.5 } });
const spin = stylex.keyframes({ to: { transform: 'rotate(360deg)' } });
const progress = stylex.keyframes({
  '0%': { transform: 'translateX(-150%) scaleX(0.6)' },
  '50%': { transform: 'translateX(80%) scaleX(1)' },
  '100%': { transform: 'translateX(300%) scaleX(0.6)' },
});

export const motion = stylex.create({
  fadeIn: {
    animationName: { default: fadeIn, [reduceMotion]: softFade },
    animationDuration: { default: '0.4s', [reduceMotion]: '0.2s' },
    animationTimingFunction: 'ease-out',
    animationFillMode: 'both',
  },
  slideIn: {
    animationName: { default: slideIn, [reduceMotion]: softFade },
    animationDuration: { default: '0.3s', [reduceMotion]: '0.2s' },
    animationTimingFunction: 'ease-out',
    animationFillMode: 'both',
  },
  pulse: {
    animationName: { default: pulse, [reduceMotion]: 'none' },
    animationDuration: '2s',
    animationTimingFunction: 'cubic-bezier(0.4, 0, 0.6, 1)',
    animationIterationCount: 'infinite',
  },
  spin: {
    animationName: { default: spin, [reduceMotion]: 'none' },
    animationDuration: '1s',
    animationTimingFunction: 'linear',
    animationIterationCount: 'infinite',
  },
  indeterminate: {
    animationName: { default: progress, [reduceMotion]: 'none' },
    animationDuration: '1.7s',
    animationTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)',
    animationIterationCount: 'infinite',
    transform: { default: null, [reduceMotion]: 'none' },
    width: { default: '40%', [reduceMotion]: '100%' },
  },
});
