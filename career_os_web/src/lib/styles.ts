import * as stylex from '@stylexjs/stylex';

export type AppStyles = stylex.StyleXArray<
  stylex.StyleXStyles | stylex.StyleXStyles<{ '--stack-space'?: string }>
>;

/** Compose typed styles first; keep className as an opaque interoperability hook. */
export function withClassName(styles: AppStyles, className?: string) {
  const props = stylex.props(styles);
  return {
    ...props,
    className: [props.className, className].filter(Boolean).join(' '),
  };
}
