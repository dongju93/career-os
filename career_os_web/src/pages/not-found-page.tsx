import * as stylex from '@stylexjs/stylex';
import { ArrowLeft, FileQuestion } from 'lucide-react';
import { Link } from 'react-router';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useDocumentTitle } from '@/hooks/use-document-title';
import { motion } from '@/styles/motion';

export function NotFoundPage() {
  useDocumentTitle('페이지를 찾을 수 없습니다');
  return (
    <div {...stylex.props([styles.notFoundPageRow, motion.fadeIn])}>
      <Card xstyle={styles.notFoundPageCard}>
        <CardContent xstyle={styles.notFoundPageCardContent}>
          <div {...stylex.props(styles.notFoundPageRow2)}>
            <FileQuestion {...stylex.props(styles.notFoundPageFileQuestion)} />
          </div>
          <div>
            <p {...stylex.props(styles.notFoundPageDescription)}>Not Found</p>
            <h1 {...stylex.props(styles.notFoundPageHeading)}>
              페이지를 찾을 수 없습니다
            </h1>
            <p {...stylex.props(styles.notFoundPageDescription2)}>
              요청하신 페이지가 존재하지 않거나 이동되었습니다
            </p>
          </div>
          <Button asChild>
            <Link to="/job-postings">
              <ArrowLeft {...stylex.props(styles.notFoundPageArrowLeft)} />
              홈으로 돌아가기
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

const styles = stylex.create({
  notFoundPageRow: {
    display: 'flex',
    minHeight: '60vh',
    alignItems: 'center',
    justifyContent: 'center',
  },
  notFoundPageCard: {
    marginLeft: 'auto',
    marginRight: 'auto',
    width: '100%',
    maxWidth: '28rem',
    textAlign: 'center',
  },
  notFoundPageCardContent: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '1rem',
    paddingTop: '3rem',
    paddingBottom: '3rem',
  },
  notFoundPageRow2: {
    display: 'flex',
    height: '4rem',
    width: '4rem',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '1rem',
    backgroundColor: 'hsl(var(--accent))',
    color: 'oklch(44.6% .03 256.802)',
    borderWidth: '1px',
  },
  notFoundPageFileQuestion: {
    height: '1.75rem',
    width: '1.75rem',
  },
  notFoundPageDescription: {
    marginBottom: '0.5rem',
    fontSize: '.75rem',
    lineHeight: '1rem',
    letterSpacing: '.1em',
    color: 'oklch(55.1% .027 264.364)',
    textTransform: 'uppercase',
  },
  notFoundPageHeading: {
    fontSize: '1.5rem',
    lineHeight: 1.25,
    fontWeight: 700,
    letterSpacing: '-.02em',
  },
  notFoundPageDescription2: {
    marginTop: '0.5rem',
    fontSize: '.875rem',
    lineHeight: '1.25rem',
    color: 'oklch(44.6% .03 256.802)',
  },
  notFoundPageArrowLeft: {
    height: '1rem',
    width: '1rem',
  },
});
