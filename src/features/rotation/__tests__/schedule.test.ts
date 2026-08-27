import {
  ROTATION_ANCHOR_HOUR,
  isRotationSchedule,
  rotationAnchorHours,
  rotationSchedulePlan,
  rotationScheduleFromLegacyHours,
  rotationScheduleFromPlan,
} from '../schedule';

// Mutation caught: a schedule that did not map to the period the worker expects
// would silently rotate at the wrong frequency.
test('each schedule maps to the period and anchor the worker is given', () => {
  expect(rotationSchedulePlan('hourly')).toEqual({ intervalHours: 1 });
  expect(rotationSchedulePlan('twice-daily')).toEqual({
    intervalHours: 12,
    anchorHour: ROTATION_ANCHOR_HOUR,
  });
  expect(rotationSchedulePlan('daily')).toEqual({
    intervalHours: 24,
    anchorHour: ROTATION_ANCHOR_HOUR,
  });
});

// Mutation caught: accepting an arbitrary string would send the native worker a
// period it rejects, leaving rotation unscheduled.
test('only the three named schedules are valid', () => {
  expect(isRotationSchedule('hourly')).toBe(true);
  expect(isRotationSchedule('twice-daily')).toBe(true);
  expect(isRotationSchedule('daily')).toBe(true);
  expect(isRotationSchedule('weekly')).toBe(false);
  expect(isRotationSchedule(12)).toBe(false);
  expect(isRotationSchedule(undefined)).toBe(false);
});

// Mutation caught: dropping the legacy mapping would reset every existing
// reader's schedule to the default instead of keeping their chosen frequency.
test('legacy interval hours map onto the nearest named schedule', () => {
  expect(rotationScheduleFromLegacyHours(6)).toBe('twice-daily');
  expect(rotationScheduleFromLegacyHours(12)).toBe('twice-daily');
  expect(rotationScheduleFromLegacyHours(24)).toBe('daily');
  expect(rotationScheduleFromLegacyHours(8)).toBeUndefined();
  expect(rotationScheduleFromLegacyHours('12')).toBeUndefined();
});

// Mutation caught: anchoring both daily runs to the same hour would rotate once
// a day while the interface promised morning and evening.
test('the anchored schedules name the clock hours they aim for', () => {
  expect(rotationAnchorHours('hourly')).toEqual([]);
  expect(rotationAnchorHours('twice-daily')).toEqual([6, 18]);
  expect(rotationAnchorHours('daily')).toEqual([6]);
});

// Mutation caught: matching on the period alone would read a stored daily
// schedule as hourly once the anchor was dropped.
test('a reported period and anchor read back as the schedule that wrote them', () => {
  expect(rotationScheduleFromPlan(1, undefined)).toBe('hourly');
  expect(rotationScheduleFromPlan(12, 6)).toBe('twice-daily');
  expect(rotationScheduleFromPlan(24, 6)).toBe('daily');
  expect(rotationScheduleFromPlan(24, undefined)).toBeUndefined();
  expect(rotationScheduleFromPlan(6, undefined)).toBeUndefined();
  expect(rotationScheduleFromPlan(undefined, undefined)).toBeUndefined();
});
