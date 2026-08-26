# Over-the-air updates

Motivana serves JavaScript and asset updates from a Cloudflare Worker.
The design is in `docs/superpowers/specs/2026-08-26-cloudflare-ota-updates-design.md`.

## What an update cannot do

An update carries JavaScript and assets only. It can never carry native code.
`runtimeVersion` uses the fingerprint policy, so a build only receives an
update built from the same native project. After any change to
`modules/motivana-wallpaper`, to a native dependency, or to `app.json`
plugins, the fingerprint changes and a store release is required.

### Fingerprint

The fingerprint comes from:

    npx expo-updates fingerprint:generate --platform android

Its `sources` list includes hashed `node_modules/.pnpm/...` paths. So any
dependency change that touches a native module shifts the fingerprint. This
is the intended protection, not a bug: it stops an update built against one
native project from reaching a device built from a different one.

The current Android fingerprint is `d92aa450fe74ef29a94d71c9dea1a60d2582c47f`.

## Environment

| Name                   | Purpose                                                             |
| ---------------------- | ------------------------------------------------------------------- |
| `OTA_WORKER_URL`       | The deployed Worker origin, with no trailing slash.                 |
| `OTA_PUBLISH_TOKEN`    | Bearer token for the pointer routes. Also a Worker secret.          |
| `OTA_PRIVATE_KEY_PATH` | The signing key, kept outside this repository.                      |
| `CLOUDFLARE_API_TOKEN` | Used by wrangler to upload assets. Optional after `wrangler login`. |

Asset upload goes through the `wrangler` CLI. No R2 access key or secret
exists anywhere in this system.

## Certificates

The private key lives outside this repository. `certs/certificate.pem` is
the only certificate file tracked in the repository.

## Publish

    pnpm ota:publish

It refuses to run on a dirty worktree, because a fingerprint that matches no
commit cannot be traced to a released build. It uploads every asset before it
writes the pointer, so an interrupted publish leaves the live update intact.

## Roll back

    pnpm ota:rollback --to <updateId>   # an earlier update, already archived
    pnpm ota:rollback --to embedded     # the bundle inside the installed binary

`--to <updateId>` does not replay the archived record. It reads the archive,
mints a new record from that manifest with `createdAt` set to now and a fresh
UUID `id`, signs those exact bytes, and writes only the pointer. The archive
itself is never modified.

This matters: `expo-updates` takes an update only when its `commitTime` is
strictly newer than the running one. Replaying the archived `createdAt` would
leave every device on the broken update, with no error shown anywhere. The
fresh `id` matters too, because a device that once ran that update still holds
the old `id` in its local update database.

Use `--to embedded` when no earlier update is good. Clients revert to the
bundle in their installed binary.

Run this once, right after the first deploy:

    pnpm ota:rollback --to no-update-available

This is one-time setup, not a rollback. It stores a signed
`noUpdateAvailable` directive in KV. Without it, the Worker answers `204 No
Content` instead. The client accepts that and keeps its current bundle, so
nothing breaks, but the explicit signed directive is the answer the protocol
intends and is what the client logs as a clean check.

The Worker never returns a multipart body with no parts. Such a body is not
zero bytes, so the client's zero-byte guard misses it and okhttp's
`MultipartReader` throws `expected at least 1 part`, which the client logs as
`UpdateFailedToLoad` on every launch.

## Deploy the Worker

    cd ota/worker && npx wrangler deploy
