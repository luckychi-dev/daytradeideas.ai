export interface AuthRateLimiterPort {
  consume(key: string): { allowed: boolean; retryAfterSeconds: number };
}

interface Bucket {
  attempts: number;
  resetAt: number;
}

export class AuthRateLimiter implements AuthRateLimiterPort {
  private readonly buckets = new Map<string, Bucket>();

  constructor(
    private readonly limit = 12,
    private readonly windowMs = 600_000,
    private readonly now = Date.now,
  ) {}

  consume(key: string): { allowed: boolean; retryAfterSeconds: number } {
    const current = this.now();
    const existing = this.buckets.get(key);
    const bucket = !existing || existing.resetAt <= current
      ? { attempts: 0, resetAt: current + this.windowMs }
      : existing;
    bucket.attempts += 1;
    this.buckets.set(key, bucket);
    return {
      allowed: bucket.attempts <= this.limit,
      retryAfterSeconds: Math.max(0, Math.ceil((bucket.resetAt - current) / 1000)),
    };
  }
}
