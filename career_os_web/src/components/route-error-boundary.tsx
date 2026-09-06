import * as stylex from '@stylexjs/stylex';
import { AlertTriangle } from 'lucide-react';
import { isRouteErrorResponse, useRouteError } from 'react-router';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { motion } from '@/styles/motion';

export function RouteErrorBoundary() {
  const error = useRouteError();

  const isDev = import.meta.env.DEV;

  let title = '예기치 않은 오류가 발생했습니다';
  let description = '잠시 후 다시 시도하거나, 홈으로 돌아가세요.';

  if (isRouteErrorResponse(error)) {
    title = `${error.status} ${error.statusText}`;
    description = typeof error.data === 'string' ? error.data : description;
  }

  return (
    <div {...stylex.props([styles.routeErrorBoundaryRow, motion.fadeIn])}>
      <Card xstyle={styles.routeErrorBoundaryCard}>
        <CardContent xstyle={styles.routeErrorBoundaryCardContent}>
          <div {...stylex.props(styles.routeErrorBoundaryRow2)}>
            <AlertTriangle
              {...stylex.props(styles.routeErrorBoundaryAlertTriangle)}
            />
          </div>
          <div>
            <p {...stylex.props(styles.routeErrorBoundaryDescription)}>Error</p>
            <h1 {...stylex.props(styles.routeErrorBoundaryHeading)}>{title}</h1>
            <p {...stylex.props(styles.routeErrorBoundaryDescription2)}>
              {description}
            </p>
          </div>
          {isDev && error instanceof Error && (
            <pre {...stylex.props(styles.routeErrorBoundaryPre)}>
              {error.stack ?? error.message}
            </pre>
          )}
          <div {...stylex.props(styles.routeErrorBoundaryRow3)}>
            <Button variant="outline" onClick={() => window.location.reload()}>
              페이지 새로고침
            </Button>
            <Button onClick={() => (window.location.href = '/job-postings')}>
              홈으로 돌아가기
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

const styles = stylex.create({
  routeErrorBoundaryRow: {
    display: 'flex',
    minHeight: '60vh',
    alignItems: 'center',
    justifyContent: 'center',
  },
  routeErrorBoundaryCard: {
    marginLeft: 'auto',
    marginRight: 'auto',
    width: '100%',
    maxWidth: '28rem',
    textAlign: 'center',
  },
  routeErrorBoundaryCardContent: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '1rem',
    paddingTop: '3rem',
    paddingBottom: '3rem',
  },
  routeErrorBoundaryRow2: {
    display: 'flex',
    height: '4rem',
    width: '4rem',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '1rem',
    backgroundColor: 'oklch(97.1% .013 17.38)',
    color: 'oklch(63.7% .237 25.331)',
    borderWidth: '1px',
    borderColor: 'oklch(93.6% .032 17.717)',
  },
  routeErrorBoundaryAlertTriangle: {
    height: '1.75rem',
    width: '1.75rem',
  },
  routeErrorBoundaryDescription: {
    marginBottom: '0.5rem',
    fontSize: '.75rem',
    lineHeight: '1rem',
    letterSpacing: '.1em',
    color: 'oklch(55.1% .027 264.364)',
    textTransform: 'uppercase',
  },
  routeErrorBoundaryHeading: {
    fontSize: '1.5rem',
    lineHeight: 1.25,
    fontWeight: 700,
    letterSpacing: '-.02em',
  },
  routeErrorBoundaryDescription2: {
    marginTop: '0.5rem',
    fontSize: '.875rem',
    lineHeight: '1.25rem',
    color: 'oklch(44.6% .03 256.802)',
  },
  routeErrorBoundaryPre: {
    width: '100%',
    overflow: 'auto',
    borderRadius: '.5rem',
    backgroundColor: 'oklch(98.5% .002 247.839)',
    paddingTop: '0.75rem',
    paddingRight: '0.75rem',
    paddingBottom: '0.75rem',
    paddingLeft: '0.75rem',
    textAlign: 'left',
    fontSize: '.75rem',
    lineHeight: '1rem',
    color: 'oklch(37.3% .034 259.733)',
    borderWidth: '1px',
  },
  routeErrorBoundaryRow3: {
    display: 'flex',
    gap: '0.5rem',
  },
});
