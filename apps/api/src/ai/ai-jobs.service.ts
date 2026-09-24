import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { describeError } from '../common/filters/http-exception.filter';

/** A job returns `{ retryInMs }` to be retried later, or nothing when finished. */
export type AiJob = (attempt: number) => Promise<{ retryInMs?: number } | void>;

export const MAX_AI_ATTEMPTS = 4;
const MAX_DELAY_MS = 90_000;

/**
 * Minimal in-process runner for AI work that must never block clinical requests
 * (e.g. a nurse's sync). Retries transient failures with the provider's retry delay or
 * exponential backoff. Jobs are keyed so the same record is never processed twice at once.
 */
@Injectable()
export class AiJobs implements OnModuleDestroy {
  private readonly logger = new Logger(AiJobs.name);
  private readonly active = new Map<string, Promise<void>>();
  private readonly timers = new Set<NodeJS.Timeout>();
  private readonly baseDelayMs = Number(process.env.AI_RETRY_BASE_MS ?? 5_000);
  private stopped = false;

  run(key: string, job: AiJob, attempt = 0) {
    if (this.stopped || this.active.has(key)) return;
    const p = job(attempt)
      .then((res) => {
        if (res?.retryInMs !== undefined && attempt + 1 < MAX_AI_ATTEMPTS && !this.stopped) {
          const delay = Math.min(MAX_DELAY_MS, Math.max(res.retryInMs, this.baseDelayMs * 2 ** attempt));
          const t = setTimeout(() => {
            this.timers.delete(t);
            this.run(key, job, attempt + 1);
          }, delay);
          this.timers.add(t);
        }
      })
      .catch((e) => this.logger.warn(`AI job ${key.split(':')[0]} failed: ${describeError(e)}`))
      .finally(() => this.active.delete(key));
    this.active.set(key, p);
  }

  /** Waits until no job is running or scheduled (used by tests and graceful shutdown). */
  async idle(timeoutMs = 30_000) {
    const until = Date.now() + timeoutMs;
    // Poll with a real timer: awaiting already-settled promises would spin the microtask
    // queue and starve the event loop (scheduled retries and I/O would never run).
    while ((this.active.size || this.timers.size) && Date.now() < until) {
      await new Promise((r) => setTimeout(r, 20));
    }
  }

  onModuleDestroy() {
    this.stopped = true;
    this.timers.forEach(clearTimeout);
    this.timers.clear();
  }
}
