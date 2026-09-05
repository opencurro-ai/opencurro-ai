/**
 * A minimal async counting semaphore.
 *
 * This is the primary safeguard against the failure mode that froze earlier multi-agent attempts:
 * many agents streaming from the provider at the same time produce a flood of tokens/second and
 * overwhelm the machine. By requiring every agent to acquire a permit before it opens a provider
 * stream, the number of CONCURRENT streams is hard-capped no matter how many agents are active — the
 * rest simply wait their turn. Permits are handed directly to the next waiter on release (FIFO), so
 * there is no busy-waiting and no lost wakeups.
 */
export class Semaphore {
  private permits: number;
  private readonly waiters: Array<() => void> = [];

  constructor(max: number) {
    this.permits = Math.max(1, Math.floor(max));
  }

  /** Acquire a permit, waiting if none are available. Always pair with a single release(). */
  async acquire(): Promise<void> {
    if (this.permits > 0) {
      this.permits -= 1;
      return;
    }
    await new Promise<void>((resolve) => this.waiters.push(resolve));
    // Resumed by release() which handed us its permit (permits was NOT incremented).
  }

  /** Release a permit, waking the next waiter if any (handing it the permit directly). */
  release(): void {
    const next = this.waiters.shift();
    if (next) {
      next();
      return;
    }
    this.permits += 1;
  }

  /** Run `fn` while holding a permit; the permit is always released, even on throw. */
  async run<T>(fn: () => Promise<T>): Promise<T> {
    await this.acquire();
    try {
      return await fn();
    } finally {
      this.release();
    }
  }
}
