import { ArrowLeft, FileQuestion } from 'lucide-react';
import { Link } from 'react-router';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

export function NotFoundPage() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center animate-fade-in">
      <Card className="max-w-md w-full mx-auto py-12 flex flex-col items-center gap-4 text-center">
        <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-muted/50 to-muted flex items-center justify-center">
          <FileQuestion className="h-8 w-8 text-muted-foreground" />
        </div>
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground mb-2">
            Not Found
          </p>
          <h1 className="text-2xl font-bold tracking-tight">
            페이지를 찾을 수 없습니다
          </h1>
          <p className="text-sm text-muted-foreground mt-2">
            요청하신 페이지가 존재하지 않거나 이동되었습니다
          </p>
        </div>
        <Button asChild>
          <Link to="/job-postings">
            <ArrowLeft className="h-4 w-4" />
            홈으로 돌아가기
          </Link>
        </Button>
      </Card>
    </div>
  );
}
