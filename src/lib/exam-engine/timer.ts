/**
 * Nexam Examination Engine - Server-Authoritative Timer
 * Guarantees that time calculations, deadlines, and grace periods
 * are strictly governed by DB/Server clock, not client clocks.
 */

export interface TimerStatus {
  startedAt: Date;
  deadlineAt: Date;
  now: Date;
  remainingSeconds: number;
  totalDurationSeconds: number;
  isExpired: boolean;
  isInGracePeriod: boolean;
  gracePeriodSeconds: number;
}

/**
 * Calculates official deadline from start time and duration.
 */
export function calculateDeadline(startedAt: Date, durationMinutes: number): Date {
  const durationMs = durationMinutes * 60 * 1000;
  return new Date(startedAt.getTime() + durationMs);
}

/**
 * Computes official timer status at current time (now).
 */
export function getTimerStatus(
  startedAt: Date | string,
  durationMinutes: number,
  nowDate: Date = new Date(),
  gracePeriodSeconds: number = 0,
  explicitDeadline?: Date | string | null
): TimerStatus {
  const start = new Date(startedAt);
  const deadline = explicitDeadline
    ? new Date(explicitDeadline)
    : calculateDeadline(start, durationMinutes);
  const now = new Date(nowDate);

  const totalDurationSeconds = Math.max(
    durationMinutes * 60,
    Math.round((deadline.getTime() - start.getTime()) / 1000)
  );
  const remainingMs = deadline.getTime() - now.getTime();
  const remainingSeconds = Math.max(0, Math.floor(remainingMs / 1000));

  const graceEndMs = deadline.getTime() + gracePeriodSeconds * 1000;
  const isExpired = now.getTime() > deadline.getTime();
  const isInGracePeriod = isExpired && now.getTime() <= graceEndMs;

  return {
    startedAt: start,
    deadlineAt: deadline,
    now,
    remainingSeconds,
    totalDurationSeconds,
    isExpired,
    isInGracePeriod,
    gracePeriodSeconds,
  };
}

/**
 * Checks if write operations (autosave) are allowed based on timer.
 * Answer writes are rejected once the official deadline has passed,
 * even during grace period (grace period is solely for finalizing submission request).
 */
export function isWriteAllowed(deadlineAt: Date | string, nowDate: Date = new Date()): boolean {
  const deadline = new Date(deadlineAt).getTime();
  const now = new Date(nowDate).getTime();
  return now <= deadline;
}

/**
 * Checks if final submission request is allowed (includes grace period).
 */
export function isSubmissionAllowed(
  deadlineAt: Date | string,
  nowDate: Date = new Date(),
  gracePeriodSeconds: number = 0
): boolean {
  const deadline = new Date(deadlineAt).getTime();
  const now = new Date(nowDate).getTime();
  const graceLimit = deadline + gracePeriodSeconds * 1000;
  return now <= graceLimit;
}
