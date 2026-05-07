import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export function QuickActions({ credits }: { credits: number }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Quick Actions</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <Button asChild className="w-full" disabled={credits === 0}>
          <Link href="/analyze">New Analysis</Link>
        </Button>
        <Button asChild variant="outline" className="w-full">
          <Link href="/reports">View All Reports</Link>
        </Button>
        {credits === 0 && (
          <Button asChild variant="secondary" className="w-full">
            <Link href="/settings">Upgrade Plan</Link>
          </Button>
        )}
        <p className="text-xs text-center text-muted-foreground">
          {credits} credit{credits !== 1 ? 's' : ''} remaining
        </p>
      </CardContent>
    </Card>
  );
}
