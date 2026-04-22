import { ArrowLeft, FileQuestion } from 'lucide-react';
import { useNavigate } from 'react-router';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export function NotFoundPage() {
  const navigate = useNavigate();

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Card className="glass-card max-w-md">
        <CardContent className="flex flex-col items-center text-center py-12 px-8">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-muted/50 to-muted mb-6">
            <FileQuestion className="h-8 w-8 text-muted-foreground" />
          </div>
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">
            Not Found
          </p>
          <h1 className="text-2xl font-bold mb-3">
            페이지를 찾을 수 없습니다
          </h1>
          <p className="text-muted-foreground mb-8">
            요청하신 페이지가 존재하지 않거나 이동되었을 수 있습니다.
          </p>
          <Button onClick={() => navigate('/')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            홈으로 돌아가기
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
