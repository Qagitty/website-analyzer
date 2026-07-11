/**
 * Cron: queue-consumer
 * Schedule: every minute
 *
 * Claims and processes jobs from the unified queue.
 * Handlers are registered at module load time.
 */

import { NextResponse } from 'next/server';
import { consumeJobs } from '@/lib/queue/consumer';
import { registerHandler, getRegisteredTypes } from '@/lib/queue/registry';
import type { QueueJobHandler } from '@/lib/queue/types';
import { analysisRunHandler }        from '@/lib/queue/handlers/analysis';
import { webhookDeliverHandler }     from '@/lib/queue/handlers/webhook';
import { emailSendHandler }          from '@/lib/queue/handlers/email';
import { monitorRunHandler, monitorPageCheckHandler, monitorDiscoveryHandler } from '@/lib/queue/handlers/monitor';
import { retentionCleanupHandler }   from '@/lib/queue/handlers/maintenance';
import { createLogger } from '@/lib/logger';
import type { QueueJobType } from '@/lib/queue/types';

export const runtime   = 'nodejs';
export const maxDuration = 55;

const log = createLogger({ category: 'cron:queue-consumer' });

// Register handlers once per process (idempotent guard via try/catch)
function registerAll() {
  const already = new Set(getRegisteredTypes());
  const pairs: [QueueJobType, QueueJobHandler][] = [
    ['analysis.run',          analysisRunHandler as QueueJobHandler],
    ['webhook.deliver',       webhookDeliverHandler as QueueJobHandler],
    ['email.send',            emailSendHandler as QueueJobHandler],
    ['monitor.run',           monitorRunHandler as QueueJobHandler],
    ['monitor.page_check',    monitorPageCheckHandler as QueueJobHandler],
    ['monitor.discovery',     monitorDiscoveryHandler as QueueJobHandler],
    ['retention.cleanup',     retentionCleanupHandler as QueueJobHandler],
  ];
  for (const [jobType, handler] of pairs) {
    if (!already.has(jobType)) {
      registerHandler(jobType, handler);
    }
  }
}

registerAll();

export async function GET(req: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = req.headers.get('Authorization');
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  const maxJobs = parseInt(process.env.QUEUE_CONSUMER_BATCH_SIZE ?? '5', 10);

  const result = await consumeJobs({
    jobTypes: [
      'analysis.run',
      'monitor.run',
      'monitor.page_check',
      'monitor.discovery',
      'webhook.deliver',
      'email.send',
      'retention.cleanup',
    ] satisfies QueueJobType[],
    maxJobs,
  });

  log.info('consumer_run', { ...result });
  return NextResponse.json({ status: 'ok', ...result });
}
