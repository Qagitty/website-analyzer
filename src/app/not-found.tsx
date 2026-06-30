import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 text-center p-8 bg-background">
      <div className="space-y-1">
        <h2 className="text-7xl font-bold text-gradient">404</h2>
        <p className="text-muted-foreground">The page you&apos;re looking for doesn&apos;t exist.</p>
      </div>
      <Button
        asChild
        className="bg-orange-600 text-white hover:opacity-90 border-0"
      >
        <Link href="/">Go home</Link>
      </Button>
    </div>
  );
}
