'use client';

import { useState, useEffect } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { ArrowRight } from 'lucide-react';

interface Activity {
  id: string;
  event_type: string;
  created_at: string;
  actor_user_id: string | null;
  previous_status: string | null;
  new_status: string | null;
  metadata: Record<string, unknown> | null;
}

const EVENT_LABELS: Record<string, string> = {
  created:              'Request created',
  updated:              'Request updated',
  assigned:             'Assigned',
  status_changed:       'Status changed',
  send_requested:       'Send requested',
  delivery_accepted:    'Delivery accepted',
  delivery_failed:      'Delivery failed',
  viewed:               'Viewed by recipient',
  acknowledged:         'Acknowledged by recipient',
  accepted:             'Accepted',
  declined:             'Declined',
  message_created:      'Message posted',
  estimate_submitted:   'Estimate submitted',
  estimate_accepted:    'Estimate accepted',
  estimate_declined:    'Estimate declined',
  fix_submitted:        'Fix submitted',
  verification_started: 'Verification started',
  verified:             'Verified',
  reopened:             'Reopened',
  public_link_created:  'Public link created',
  public_link_revoked:  'Public link revoked',
  closed:               'Closed',
  cancelled:            'Cancelled',
};

interface Props {
  fixRequestId: string;
}

export function ActivityTimeline({ fixRequestId }: Props) {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/fix-requests/${fixRequestId}/activities`)
      .then((r) => r.json())
      .then((data) => setActivities(data.activities ?? data ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [fixRequestId]);

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-12 bg-card rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  if (activities.length === 0) {
    return <p className="text-sm text-muted-foreground text-center py-8">No activity yet</p>;
  }

  return (
    <div className="relative space-y-0">
      {activities.map((activity, idx) => (
        <div key={activity.id} className="flex gap-3 pb-4">
          <div className="flex flex-col items-center">
            <div className="h-2 w-2 rounded-full bg-indigo-500 mt-1.5 shrink-0" />
            {idx < activities.length - 1 && (
              <div className="w-px flex-1 bg-border mt-1" />
            )}
          </div>
          <div className="pb-1 min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-medium text-foreground">
                {EVENT_LABELS[activity.event_type] ?? activity.event_type}
              </span>
              {activity.previous_status && activity.new_status && (
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <span className="text-zinc-400">{activity.previous_status}</span>
                  <ArrowRight className="h-3 w-3" />
                  <span className="text-indigo-400">{activity.new_status}</span>
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {formatDistanceToNow(new Date(activity.created_at), { addSuffix: true })}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
