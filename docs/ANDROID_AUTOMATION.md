# Android automation

Motivana rotation is a best-effort Android background feature. It has no server
and never starts React Native or reads MMKV from a worker.

## Settings and targets

The Automation screen selects enabled/disabled, `6`, `12`, or `24` hours,
Home/Lock/Both, the selected preset or randomized presets, and optional
favorites-only quotes. Favorites-only rejects an empty list. Target choices are
filtered by the live `WallpaperManager` capability result; Lock and Both are
unavailable where the platform cannot support them.

The worker-readable configuration is one strict JSON snapshot in Android
SharedPreferences file `motivana.wallpaper.automation`. A synchronous
`commit()` writes it before schedule mutation. Status is stored separately as
disabled, scheduled, running, succeeded, or failed, with safe IDs/timestamps
and an allow-listed error code. Status never records quote text or arbitrary
exception messages.

## Scheduling and execution

- Periodic unique work name: `motivana.wallpaper.rotation`
- Periodic replacement policy: WorkManager `UPDATE`
- Debug one-time unique work name: `motivana.wallpaper.rotation.debug`
- Debug replacement policy: WorkManager `REPLACE`
- Constraint: battery not low
- Backoff: exponential, 15 minutes

Changing an enabled configuration replaces the periodic request. Disabling
cancels that unique request and records disabled only after cancellation is
confirmed. Android may defer periodic work; the selected interval is an
approximation, not an exact alarm.

The worker validates the snapshot and packaged catalog; selects an eligible
quote without repeating the previous quote when an alternative exists; selects
the preferred/random preset; renders a full-resolution native bitmap; applies
it to the supported target; recycles the bitmap; then records success. Invalid
configuration, empty favorites, unsupported targets, invalid assets, or missing
fonts are permanent failures. Transient asset I/O and system wallpaper failures
record a safe code and request WorkManager retry.

Debug builds expose **Run rotation now**. Release Kotlin rejects this path with
`DEBUG_ONLY`; it is not a release UI feature.

## Stable errors and recovery

The public `WallpaperServiceErrorCode` vocabulary is `PERMISSION_DENIED`, `FILE_NOT_FOUND`,
`SAVE_FAILED`, `INVALID_TARGET`, `WALLPAPER_NOT_ALLOWED`, `LOCK_UNSUPPORTED`,
`DECODE_FAILED`, `APPLY_FAILED`, `NOT_IMPLEMENTED`, `DEBUG_ONLY`,
`INVALID_CONFIGURATION`, `EMPTY_FAVORITES`, `CONFIGURE_FAILED`,
`ASSET_FAILED`, `ASSET_INVALID`, `ASSET_IO`, `FONT_MISSING`, `RENDER_FAILED`,
`SCHEDULER_FAILED`, and `SYSTEM_FAILED`. These are safe UI/native boundary
codes; the UI keeps the active composition and does not surface raw Android
exception messages.

Foreground export has its own public `RenderError` codes: `INVALID_DIMENSIONS`,
`SURFACE_CREATION_FAILED`, `DRAW_FAILED`, `ENCODE_FAILED`, and
`FILE_WRITE_FAILED`. `WallpaperActions` presents these as explicit export
failures and retains the composition for retry.

The persisted worker `errorCode` is deliberately narrower:
`INVALID_CONFIGURATION`, `EMPTY_FAVORITES`, `LOCK_UNSUPPORTED`, `FONT_MISSING`,
`ASSET_INVALID`, `ASSET_IO`, `SYSTEM_FAILED`, `RENDER_FAILED`, `APPLY_FAILED`,
and `NO_ELIGIBLE_QUOTES`. `CONFIGURE_FAILED` and `SCHEDULER_FAILED` are public
configuration/scheduling outcomes, not stored worker status values.

Force-stopping an app suppresses its jobs until Android permits execution again.
Doze, battery restrictions, OEM task killers, reboot, app update, screen lock,
and vendor wallpaper behavior can delay or prevent work. The emulator proves
the native pipeline and WorkManager integration, but a physical-device matrix
remains the release gate.
