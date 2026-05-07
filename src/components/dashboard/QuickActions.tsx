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
        <Button
          asChild
          className="w-full bg-gradient-to-r from-indigo-500 to-violet-500 text-white hover:from-indigo-400 hover:to-violet-400"
          disabled={credits === 0}
        >
          <Link href="/analyze">New Analysis</Link>
        </Button>
        <Button asChild variant="outline" className="w-full border border-indigo-500/30 text-indigo-300 bg-transparent hover:bg-indigo-500/10">
          <Link href="/reports">View All Reports</Link>
        </Button>
        {credits === 0 && (
          <Button asChild variant="outline" className="w-full border border-indigo-500/30 text-indigo-300 bg-transparent hover:bg-indigo-500/10">
            <Link href="/settings">Upgrade Plan</Link>
          </Button>
        )}
        <p className="text-xs text-center text-[#475569]">
          {credits} credit{credits !== 1 ? 's' : ''} remaining
        </p>
      </CardContent>
    </Card>
  );
}
