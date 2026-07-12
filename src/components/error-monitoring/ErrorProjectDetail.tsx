'use client';

import { useState } from 'react';
import { ErrorIssuesList } from './ErrorIssuesList';
import { ErrorInstallationPanel } from './ErrorInstallationPanel';
import { ErrorProjectSettings } from './ErrorProjectSettings';

type TabId = 'issues' | 'installation' | 'settings';

interface ErrorProject {
  id:                  string;
  name:                string;
  normalized_origin:   string;
  environment:         string;
  status:              string;
  ingestion_key_prefix: string;
  last_event_at:       string | null;
  created_at:          string;
  event_quota_monthly: number;
  retention_days:      number;
  allowed_origins:     string[];
}

interface ErrorIssue {
  id:            string;
  title:         string;
  level:         string;
  status:        string;
  event_count:   number;
  first_seen_at: string;
  last_seen_at:  string;
}

interface Props {
  project: ErrorProject;
  issues:  ErrorIssue[];
  total:   number;
}

const TABS: Array<{ id: TabId; label: string }> = [
  { id: 'issues',       label: 'Issues' },
  { id: 'installation', label: 'Installation' },
  { id: 'settings',     label: 'Settings' },
];

export function ErrorProjectDetail({ project, issues, total }: Props) {
  const [tab, setTab] = useState<TabId>('issues');

  const appUrl = typeof window !== 'undefined' ? window.location.origin : '';

  return (
    <div className="space-y-4">
      {/* Tab bar */}
      <div className="flex gap-1 border-b border-border">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={[
              'px-4 py-2 text-sm font-medium border-b-2 transition-colors',
              tab === t.id
                ? 'border-indigo-500 text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            ].join(' ')}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'issues' && (
        <ErrorIssuesList
          projectId={project.id}
          issues={issues}
          total={total}
        />
      )}

      {tab === 'installation' && (
        <ErrorInstallationPanel
          projectId={project.id}
          ingestionKeyPrefix={project.ingestion_key_prefix}
          appUrl={appUrl}
        />
      )}

      {tab === 'settings' && (
        <ErrorProjectSettings project={project} />
      )}
    </div>
  );
}
