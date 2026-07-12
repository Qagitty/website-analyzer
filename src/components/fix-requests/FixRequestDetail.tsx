'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { ArrowLeft, Send, Trash2, Archive, RotateCcw, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { FixRequestStatusBadge } from './FixRequestStatusBadge';
import { FixRequestSeverityBadge } from './FixRequestSeverityBadge';
import { FixRequestTypeBadge } from './FixRequestTypeBadge';
import { SendRequestDialog } from './SendRequestDialog';
import { MessageThread } from './MessageThread';
import { ActivityTimeline } from './ActivityTimeline';
import { PublicLinkCard } from './PublicLinkCard';
import { GenerateLinkDialog } from './GenerateLinkDialog';
import type { FixRequestStatus, FixRequestSeverity, FixRequestType, FixRequestEvidence } from '@/types/fix-request';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;

interface Props {
  fixRequest: Row;
  canWebhook: boolean;
  canTeamAssign: boolean;
}

export function FixRequestDetail({ fixRequest: initialFr, canWebhook, canTeamAssign }: Props) {
  const router = useRouter();
  const [fr, setFr] = useState<Row>(initialFr);
  const [sendOpen, setSendOpen] = useState(false);
  const [generateLinkOpen, setGenerateLinkOpen] = useState(false);
  const [publicLinks, setPublicLinks] = useState<Row[]>([]);
  const [linksLoaded, setLinksLoaded] = useState(false);
  const [patching, setPatching] = useState(false);

  async function patchStatus(newStatus: FixRequestStatus) {
    setPatching(true);
    try {
      const res = await fetch(`/api/fix-requests/${fr.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? 'Failed to update');
      }
      const data = await res.json();
      setFr(data.fixRequest ?? { ...fr, status: newStatus });
      toast.success('Status updated');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update');
    } finally {
      setPatching(false);
    }
  }

  async function handleDelete() {
    if (!confirm('Delete this fix request? This cannot be undone.')) return;
    try {
      const res = await fetch(`/api/fix-requests/${fr.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');
      toast.success('Fix request deleted');
      router.push('/fix-requests');
    } catch {
      toast.error('Failed to delete');
    }
  }

  async function loadPublicLinks() {
    if (linksLoaded) return;
    try {
      const res = await fetch(`/api/fix-requests/${fr.id}/public-link`);
      if (!res.ok) return;
      const data = await res.json();
      setPublicLinks(data.links ?? data ?? []);
    } finally {
      setLinksLoaded(true);
    }
  }

  const status = fr.status as FixRequestStatus;
  const severity = fr.severity as FixRequestSeverity;
  const requestType = fr.request_type as FixRequestType;
  const affectedUrls: string[] = fr.affected_urls ?? [];
  const reproductionSteps: string[] = fr.reproduction_steps ?? [];
  const verificationSteps: string[] = fr.verification_steps ?? [];
  const evidence: FixRequestEvidence[] = fr.evidence ?? [];

  const terminalStatuses: FixRequestStatus[] = ['closed', 'cancelled'];
  const isTerminal = terminalStatuses.includes(status);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="space-y-4">
        <Link
          href="/fix-requests"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Fix Requests
        </Link>

        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <FixRequestTypeBadge type={requestType} />
              <FixRequestSeverityBadge severity={severity} />
              <FixRequestStatusBadge status={status} />
            </div>
            <h1 className="text-2xl font-bold text-gradient">{fr.title}</h1>
            <p className="text-sm text-muted-foreground">
              Created {formatDistanceToNow(new Date(fr.created_at), { addSuffix: true })}
            </p>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 flex-wrap shrink-0">
            {status === 'draft' && (
              <>
                <Button
                  size="sm"
                  onClick={() => patchStatus('ready')}
                  disabled={patching}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  Mark Ready
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleDelete}
                  className="text-red-400 border-red-500/30 hover:bg-red-500/10"
                >
                  <Trash2 className="h-3.5 w-3.5 mr-1" />
                  Delete
                </Button>
              </>
            )}
            {status === 'ready' && (
              <>
                <Button
                  size="sm"
                  onClick={() => setSendOpen(true)}
                  className="bg-indigo-600 hover:bg-indigo-700"
                >
                  <Send className="h-3.5 w-3.5 mr-1" />
                  Send Request
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => patchStatus('draft')}
                  disabled={patching}
                >
                  Back to Draft
                </Button>
              </>
            )}
            {status === 'delivery_failed' && (
              <Button
                size="sm"
                onClick={() => setSendOpen(true)}
                className="bg-indigo-600 hover:bg-indigo-700"
              >
                <RotateCcw className="h-3.5 w-3.5 mr-1" />
                Retry Send
              </Button>
            )}
            {status === 'in_progress' && (
              <Button
                size="sm"
                onClick={() => patchStatus('fix_submitted')}
                disabled={patching}
                className="bg-violet-600 hover:bg-violet-700"
              >
                Submit Fix
              </Button>
            )}
            {status === 'fix_submitted' && (
              <Button
                size="sm"
                onClick={() => patchStatus('verification_required')}
                disabled={patching}
                className="bg-violet-600 hover:bg-violet-700"
              >
                Request Verification
              </Button>
            )}
            {status === 'verified' && (
              <Button
                size="sm"
                onClick={() => patchStatus('closed')}
                disabled={patching}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                <CheckCircle className="h-3.5 w-3.5 mr-1" />
                Close
              </Button>
            )}
            {!isTerminal && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => patchStatus('cancelled')}
                disabled={patching}
                className="text-zinc-400 border-zinc-500/30 hover:bg-zinc-500/10"
              >
                <XCircle className="h-3.5 w-3.5 mr-1" />
                Cancel
              </Button>
            )}
            {!isTerminal && (
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8"
                title="Archive"
                onClick={async () => {
                  try {
                    await fetch(`/api/fix-requests/${fr.id}`, {
                      method: 'PATCH',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ is_archived: !fr.is_archived }),
                    });
                    setFr({ ...fr, is_archived: !fr.is_archived });
                    toast.success(fr.is_archived ? 'Unarchived' : 'Archived');
                  } catch {
                    toast.error('Failed to archive');
                  }
                }}
              >
                <Archive className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview">
        <TabsList className="bg-card border border-border">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="conversation">Conversation</TabsTrigger>
          <TabsTrigger value="delivery" onClick={loadPublicLinks}>Delivery</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4 mt-4">
          {fr.summary && (
            <Card className="bg-card border-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-foreground">{fr.summary}</p>
              </CardContent>
            </Card>
          )}

          <div className="grid grid-cols-2 gap-4">
            <Card className="bg-card border-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Type</span>
                  <FixRequestTypeBadge type={requestType} />
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Severity</span>
                  <FixRequestSeverityBadge severity={severity} />
                </div>
                {fr.category && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Category</span>
                    <span className="text-foreground">{fr.category}</span>
                  </div>
                )}
                {fr.source_type && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Source</span>
                    <span className="text-foreground capitalize">{fr.source_type.replace(/_/g, ' ')}</span>
                  </div>
                )}
                {fr.requested_due_date && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Due</span>
                    <span className="text-foreground">{fr.requested_due_date}</span>
                  </div>
                )}
                {fr.requested_priority && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Priority</span>
                    <span className="text-foreground capitalize">{fr.requested_priority}</span>
                  </div>
                )}
              </CardContent>
            </Card>

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
          </div>

          {fr.technical_description && (
            <Card className="bg-card border-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Technical Details</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-foreground whitespace-pre-wrap">{fr.technical_description}</p>
              </CardContent>
            </Card>
          )}

          {reproductionSteps.length > 0 && (
            <Card className="bg-card border-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Reproduction Steps</CardTitle>
              </CardHeader>
              <CardContent>
                <ol className="list-decimal list-inside space-y-1">
                  {reproductionSteps.map((step, i) => (
                    <li key={i} className="text-sm text-foreground">{step}</li>
                  ))}
                </ol>
              </CardContent>
            </Card>
          )}

          {fr.recommended_fix && (
            <Card className="bg-card border-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Recommended Fix</CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="text-xs text-foreground bg-muted/50 rounded p-3 overflow-x-auto whitespace-pre-wrap">
                  {fr.recommended_fix}
                </pre>
              </CardContent>
            </Card>
          )}

          {evidence.filter((e) => !e.isPrivate).length > 0 && (
            <Card className="bg-card border-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Evidence</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {evidence.filter((e) => !e.isPrivate).map((ev, i) => (
                  <div key={i} className="flex items-start gap-2 text-sm">
                    <Badge variant="outline" className="text-xs shrink-0 bg-indigo-500/10 text-indigo-400 border-indigo-500/20 capitalize">
                      {ev.type}
                    </Badge>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{ev.label}</p>
                      <p className="text-muted-foreground text-xs truncate">{ev.value}</p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {verificationSteps.length > 0 && (
            <Card className="bg-card border-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Verification Steps</CardTitle>
              </CardHeader>
              <CardContent>
                <ol className="list-decimal list-inside space-y-1">
                  {verificationSteps.map((step, i) => (
                    <li key={i} className="text-sm text-foreground">{step}</li>
                  ))}
                </ol>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Conversation Tab */}
        <TabsContent value="conversation" className="mt-4">
          <MessageThread fixRequestId={fr.id} />
        </TabsContent>

        {/* Delivery Tab */}
        <TabsContent value="delivery" className="space-y-4 mt-4">
          <div className="flex items-center justify-between">
            <h3 className="font-medium">Public Links</h3>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setGenerateLinkOpen(true)}
              className="border-indigo-500/30 text-indigo-400 hover:bg-indigo-500/10"
            >
              Generate Link
            </Button>
          </div>

          {publicLinks.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">No public links yet</p>
          ) : (
            <div className="space-y-2">
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          {publicLinks.map((link: any) => (
                <PublicLinkCard
                  key={link.id}
                  link={link}
                  fixRequestId={fr.id}
                  onRevoked={() => {
                    setLinksLoaded(false);
                    loadPublicLinks();
                  }}
                />
              ))}
            </div>
          )}

          <div className="border-t border-border pt-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-medium">Send via Channel</h3>
            </div>
            <Button
              onClick={() => setSendOpen(true)}
              className="bg-indigo-600 hover:bg-indigo-700"
              disabled={isTerminal}
            >
              <Send className="h-4 w-4 mr-2" />
              Send
            </Button>
          </div>
        </TabsContent>

        {/* Activity Tab */}
        <TabsContent value="activity" className="mt-4">
          <ActivityTimeline fixRequestId={fr.id} />
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      <SendRequestDialog
        fixRequestId={fr.id}
        open={sendOpen}
        onOpenChange={setSendOpen}
        canWebhook={canWebhook}
        canTeamAssign={canTeamAssign}
        onSuccess={() => {
          setFr({ ...fr, status: 'sending' });
        }}
      />
      <GenerateLinkDialog
        fixRequestId={fr.id}
        open={generateLinkOpen}
        onOpenChange={setGenerateLinkOpen}
        onCreated={() => {
          setLinksLoaded(false);
          loadPublicLinks();
        }}
      />
    </div>
  );
}
