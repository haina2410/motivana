/**
 * How often the wallpaper rotates, named the way the reader chooses it rather
 * than as a bare period. Two of the three aim for a clock hour: a plain twelve
 * hour period saved at three in the afternoon would fire at three in the
 * morning, which is not what "morning and evening" promises.
 */
export type RotationSchedule = 'hourly' | 'twice-daily' | 'daily';

/** The morning hour the anchored schedules aim for, in local time. */
export const ROTATION_ANCHOR_HOUR = 6;

export interface RotationSchedulePlan {
  /** The repeat period handed to the Android worker. */
  intervalHours: 1 | 12 | 24;
  /**
   * The local clock hour the first run aims for. Absent for `hourly`, which
   * starts a period from now rather than waiting for a particular hour.
   */
  anchorHour?: number;
}

const plans: Readonly<Record<RotationSchedule, RotationSchedulePlan>> = {
  hourly: { intervalHours: 1 },
  'twice-daily': { intervalHours: 12, anchorHour: ROTATION_ANCHOR_HOUR },
  daily: { intervalHours: 24, anchorHour: ROTATION_ANCHOR_HOUR },
};

export const rotationSchedules = Object.freeze([
  'hourly',
  'twice-daily',
  'daily',
] as const satisfies readonly RotationSchedule[]);

export function isRotationSchedule(value: unknown): value is RotationSchedule {
  return value === 'hourly' || value === 'twice-daily' || value === 'daily';
}

export function rotationSchedulePlan(
  schedule: RotationSchedule,
): RotationSchedulePlan {
  return plans[schedule];
}

/**
 * The schedule a reader on the old six, twelve or twenty-four hour control
 * lands on. Six hours is four rotations a day and neither named option is
 * close, so it takes the gentler of the two.
 */
export function rotationScheduleFromLegacyHours(
  hours: unknown,
): RotationSchedule | undefined {
  if (hours === 6 || hours === 12) return 'twice-daily';
  if (hours === 24) return 'daily';
  return undefined;
}

/** The clock hours a schedule aims for, ascending. Empty when unanchored. */
export function rotationAnchorHours(schedule: RotationSchedule): number[] {
  const { intervalHours, anchorHour } = plans[schedule];
  if (anchorHour === undefined) return [];
  const hours: number[] = [];
  for (let hour = anchorHour; hour < 24; hour += intervalHours) {
    hours.push(hour);
  }
  return hours;
}

/**
 * The schedule behind a period and anchor the worker reported back. Returns
 * undefined for a combination this build never writes, so a status left by an
 * older build cannot be shown as a schedule the reader could not have chosen.
 */
export function rotationScheduleFromPlan(
  intervalHours: unknown,
  anchorHour: unknown,
): RotationSchedule | undefined {
  return rotationSchedules.find((schedule) => {
    const plan = plans[schedule];
    return (
      plan.intervalHours === intervalHours &&
      (plan.anchorHour ?? undefined) === (anchorHour ?? undefined)
    );
  });
}
