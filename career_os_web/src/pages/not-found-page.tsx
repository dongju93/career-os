import { ArrowLeft, FileQuestion } from 'lucide-react';
import { Link } from 'react-router';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export function NotFoundPage() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center animate-fade-in">
      <Card className="mx-auto w-full max-w-md text-center">
        <CardContent className="flex flex-col items-center gap-4 py-12">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-accent text-gray-600 border">
            <FileQuestion className="h-7 w-7" />
          </div>
          <div>
            <p className="mb-2 text-xs tracking-widest text-gray-500 uppercase">
              Not Found
            </p>
            <h1 className="text-2xl font-bold tracking-tight">
              페이지를 찾을 수 없습니다
            </h1>
            <p className="mt-2 text-sm text-gray-600">
              요청하신 페이지가 존재하지 않거나 이동되었습니다
            </p>
          </div>
          <Button asChild>
            <Link to="/job-postings">
              <ArrowLeft className="h-4 w-4" />
              홈으로 돌아가기
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
