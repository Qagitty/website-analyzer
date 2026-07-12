'use client';

import { useState } from 'react';
import { Copy, CheckCircle2, FlaskConical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface Props {
  projectId:          string;
  ingestionKeyPrefix: string;
  appUrl:             string;
}

export function ErrorInstallationPanel({ projectId, ingestionKeyPrefix, appUrl }: Props) {
  const [testLoading, setTestLoading] = useState(false);
  const [copied, setCopied]           = useState(false);

  const snippet = `<script
  src="${appUrl}/api/error-monitoring/sdk"
  data-project-key="${ingestionKeyPrefix}[FULL_KEY]"
  data-environment="production"
  defer
  crossorigin="anonymous"
></script>`;

  const copySnippet = async () => {
    try {
      await navigator.clipboard.writeText(snippet);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Failed to copy');
    }
  };

  const sendTestEvent = async () => {
    setTestLoading(true);
    try {
      const res = await fetch(`/api/error-monitoring/projects/${projectId}/test-event`, {
        method: 'POST',
      });
      if (!res.ok) throw new Error('Failed');
      toast.success('Test event sent! Check the Issues tab.');
    } catch {
      toast.error('Failed to send test event.');
    } finally {
      setTestLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-semibold mb-2">Add to your HTML</h3>
        <div className="relative">
          <pre className="rounded-lg bg-[#0A0A0F] border border-border p-4 text-xs font-mono overflow-x-auto text-indigo-300 whitespace-pre-wrap break-all">
            {snippet}
          </pre>
          <Button
            variant="ghost"
            size="sm"
            className="absolute top-2 right-2 h-7 text-xs"
            onClick={copySnippet}
          >
            {copied ? (
              <CheckCircle2 className="h-3.5 w-3.5 mr-1 text-emerald-400" />
            ) : (
              <Copy className="h-3.5 w-3.5 mr-1" />
            )}
            {copied ? 'Copied!' : 'Copy'}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          Replace <code className="font-mono text-indigo-400">[FULL_KEY]</code> with your actual ingestion key shown at project creation.
        </p>
      </div>

      <div className="border border-border rounded-lg p-4 space-y-3">
        <h3 className="text-sm font-semibold">Verify installation</h3>
        <p className="text-xs text-muted-foreground">
          Send a test event to confirm the SDK is configured correctly.
        </p>
        <Button
          onClick={sendTestEvent}
          disabled={testLoading}
          className="bg-indigo-600 hover:bg-indigo-700"
          size="sm"
        >
          <FlaskConical className="h-4 w-4 mr-2" />
          {testLoading ? 'Sending…' : 'Send test event'}
        </Button>
      </div>

      <div className="border border-border rounded-lg p-4">
        <h3 className="text-sm font-semibold mb-3">Next.js setup</h3>
        <pre className="text-xs font-mono bg-[#0A0A0F] rounded p-3 overflow-x-auto text-indigo-300">{`// app/layout.tsx
import Script from 'next/script'

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        {children}
        <Script
          src="${appUrl}/api/error-monitoring/sdk"
          data-project-key="ws_err_YOUR_KEY"
          data-environment={process.env.NODE_ENV}
          strategy="afterInteractive"
          crossOrigin="anonymous"
        />
      </body>
    </html>
  )
}`}</pre>
      </div>
    </div>
  );
}
