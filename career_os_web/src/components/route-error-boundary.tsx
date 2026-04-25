import { AlertTriangle } from 'lucide-react';
import { isRouteErrorResponse, useRouteError } from 'react-router';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

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
    <div className="flex min-h-[60vh] items-center justify-center animate-fade-in">
      <Card className="mx-auto w-full max-w-md text-center">
        <CardContent className="flex flex-col items-center gap-4 py-12">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-red-50 text-red-500 border border-red-100">
            <AlertTriangle className="h-7 w-7" />
          </div>
          <div>
            <p className="mb-2 text-xs tracking-widest text-gray-500 uppercase">
              Error
            </p>
            <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
            <p className="mt-2 text-sm text-gray-600">{description}</p>
          </div>
          {isDev && error instanceof Error && (
            <pre className="w-full overflow-auto rounded-lg bg-gray-50 p-3 text-left text-xs text-gray-700 border">
              {error.stack ?? error.message}
            </pre>
          )}
          <div className="flex gap-2">
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
