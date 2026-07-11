/**
 * Handler registry — maps QueueJobType to the function that processes it.
 *
 * Register handlers at startup; the consumer looks them up by job type.
 * Unknown job types are moved to the DLQ with errorCode 'UNREGISTERED_JOB_TYPE'.
 */

import type { QueueJobHandler, QueueJobType } from './types';

type HandlerMap = {
  [K in QueueJobType]?: QueueJobHandler;
};

const registry: HandlerMap = {};

export function registerHandler<TPayload>(
  jobType: QueueJobType,
  handler: QueueJobHandler<TPayload>,
): void {
  if (registry[jobType]) {
    throw new Error(`Handler already registered for job type: ${jobType}`);
  }
  registry[jobType] = handler as QueueJobHandler;
}

export function getHandler(jobType: QueueJobType): QueueJobHandler | undefined {
  return registry[jobType];
}

export function getRegisteredTypes(): QueueJobType[] {
  return Object.keys(registry) as QueueJobType[];
}
