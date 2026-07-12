import { Metadata } from 'next';
import type { ReactNode } from 'react';
import { headers } from 'next/headers';
import { AlertTriangle, Wrench } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Fix Request' };

const SEVERITY_LABELS: Record<string, string> = {
  critical:      'Critical',
  high:          'High',
  medium:        'Medium',
  low:           'Low',
  informational: 'Info',
};

const SEVERITY_CLASSES: Record<string, string> = {
  critical:      'bg-red-500/20 text-red-400 border-red-500/30',
  high:          'bg-orange-500/20 text-orange-400 border-orange-500/30',
  medium:        'bg-amber-500/20 text-amber-400 border-amber-500/30',
  low:           'bg-blue-500/20 text-blue-400 border-blue-500/30',
  informational: 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30',
};

const STATUS_LABELS: Record<string, string> = {
  draft:                   'Draft',
  ready:                   'Ready',
  sending:                 'Sending',
  sent:                    'Sent',
  delivered:               'Delivered',
  delivery_failed:         'Delivery Failed',
  acknowledged:            'Acknowledged',
  in_review:               'In Review',
  accepted:                'Accepted',
  declined:                'Declined',
  in_progress:             'In Progress',
  waiting_for_information: 'Waiting for Info',
  fix_submitted:           'Fix Submitted',
  verification_required:   'Verification Required',
  verified:                'Verified',
  closed:                  'Closed',
  cancelled:               'Cancelled',
};

export default async function PublicFixRequestPage(props: {
  params: Promise<{ token: string }>;
}) {
  const params = await props.params;
  const h = await headers();
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:3000';
  const proto = h.get('x-forwarded-proto') ?? 'http';
  const baseUrl = `${proto}://${host}`;

  let data: Record<string, unknown> | null = null;
  let errorStatus: number | null = null;

  try {
    const res = await fetch(`${baseUrl}/api/public/fix-request/${params.token}`, {
      cache: 'no-store',
    });
    if (res.status === 410) {
      errorStatus = 410;
    } else if (res.status === 404) {
      errorStatus = 404;
    } else if (!res.ok) {
      errorStatus = res.status;
    } else {
      data = await res.json();
    }
  } catch {
    errorStatus = 500;
  }

  if (errorStatus === 410) {
    return (
      <PublicLayout>
        <div className="flex flex-col items-center justify-center py-24 text-center gap-4">
          <AlertTriangle className="h-12 w-12 text-amber-400" />
          <h1 className="text-xl font-semibold">Link Expired or Revoked</h1>
          <p className="text-sm text-muted-foreground max-w-sm">
            This shared fix request link has expired or been revoked by the sender.
          </p>
        </div>
      </PublicLayout>
    );
  }

  if (!data || errorStatus) {
    return (
      <PublicLayout>
        <div className="flex flex-col items-center justify-center py-24 text-center gap-4">
          <AlertTriangle className="h-12 w-12 text-zinc-400" />
          <h1 className="text-xl font-semibold">Not Found</h1>
          <p className="text-sm text-muted-foreground max-w-sm">
            This fix request link could not be found.
          </p>
        </div>
      </PublicLayout>
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fr = data as any;
  const scope = fr.scope as string | undefined;
  const affectedUrls = (fr.affected_urls ?? []) as string[];
  const evidence = (fr.evidence ?? []) as Array<{ type: string; label: string; value: string; isPrivate: boolean }>;
  const publicEvidence = evidence.filter((e) => !e.isPrivate);
  const severity = String(fr.severity ?? '');
  const status = String(fr.status ?? '');
  const title = String(fr.title ?? '');
  const summary = fr.summary ? String(fr.summary) : null;
  const technicalDescription = fr.technical_description ? String(fr.technical_description) : null;
  const recommendedFix = fr.recommended_fix ? String(fr.recommended_fix) : null;
  const canAcknowledge = Boolean(fr.canAcknowledge);

  return (
    <PublicLayout>
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-2 pb-4 border-b border-border">
          <div className="flex items-center justify-center gap-2 text-muted-foreground text-sm">
            <Wrench className="h-4 w-4" />
            <span>Shared Fix Request</span>
          </div>
          <h1 className="text-2xl font-bold">{title}</h1>
          <div className="flex items-center justify-center gap-2">
            <Badge variant="outline" className={`border ${SEVERITY_CLASSES[severity] ?? 'bg-zinc-500/20 text-zinc-400'}`}>
              {SEVERITY_LABELS[severity] ?? severity}
            </Badge>
            <Badge variant="outline" className="bg-zinc-500/10 text-zinc-400 border-zinc-500/20">
              {STATUS_LABELS[status] ?? status}
            </Badge>
          </div>
        </div>

        {/* Summary */}
        {summary && (
          <Card className="bg-card border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm">{summary}</p>
            </CardContent>
          </Card>
        )}

        {/* Technical details — only shown when scope is full_technical */}
        {scope === 'full_technical' && (
          <>
            {technicalDescription && (
              <Card className="bg-card border-border">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Technical Details</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm whitespace-pre-wrap">{technicalDescription}</p>
                </CardContent>
              </Card>
            )}

            {recommendedFix && (
              <Card className="bg-card border-border">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Recommended Fix</CardTitle>
                </CardHeader>
                <CardContent>
                  <pre className="text-xs bg-muted/50 rounded p-3 overflow-x-auto whitespace-pre-wrap">
                    {recommendedFix}
                  </pre>
                </CardContent>
              </Card>
            )}
          </>
        )}

        {/* Affected URLs */}
        {affectedUrls.length > 0 && (
          <Card className="bg-card border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Affected URLs</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-1">
                {affectedUrls.map((url, i) => (
                  <li key={i} className="text-xs font-mono text-indigo-400 truncate">{url}</li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {/* Public evidence */}
        {publicEvidence.length > 0 && (
          <Card className="bg-card border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Evidence</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {publicEvidence.map((ev, i) => (
                <div key={i} className="flex items-start gap-2 text-sm">
                  <Badge variant="outline" className="text-xs shrink-0 bg-indigo-500/10 text-indigo-400 border-indigo-500/20 capitalize">
                    {ev.type}
                  </Badge>
                  <div>
                    <p className="font-medium">{ev.label}</p>
                    <p className="text-muted-foreground text-xs">{ev.value}</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Acknowledge note */}
        {canAcknowledge && (
          <div className="rounded-lg border border-cyan-500/20 bg-cyan-500/5 p-4 text-sm text-cyan-300">
            Please review the above fix request and acknowledge receipt by replying directly to the
            sender.
          </div>
        )}

        <p className="text-center text-xs text-muted-foreground pb-4">
          Shared via WebScore Fix Requests
        </p>
      </div>
    </PublicLayout>
  );
}

function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[#0A0A0F] text-foreground">
      <div className="max-w-2xl mx-auto px-4 py-12">{children}</div>
    </div>
  );
}
