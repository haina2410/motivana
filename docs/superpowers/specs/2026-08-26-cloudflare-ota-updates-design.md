# Over-the-Air Updates on Cloudflare Workers

Date: 2026-08-26
Status: Proposed
Platform: Android (the design leaves room for iOS)

## Goal

Motivana must send JavaScript and asset updates to installed apps without a
store release. The update server is self-hosted on a Cloudflare Worker.

## Why not CodePush

Microsoft App Center closed on 31 March 2025, and `react-native-code-push`
closed with it. Motivana is an Expo SDK 57 app, so the correct mechanism is
`expo-updates`, which speaks the open
[Expo Updates protocol v1](https://docs.expo.dev/technical-specs/expo-updates-1/).
Any server that conforms to that protocol can serve updates. A Cloudflare
Worker conforms easily: the protocol needs request-header routing, a
`multipart/mixed` response, content-addressed file storage, and RSA-SHA256
signatures. Workers, R2 and WebCrypto supply all four.

## Constraints

1. **An update can change JavaScript and assets only. It can never change
   native code.** Motivana has a Kotlin native module,
   `modules/motivana-wallpaper`. If the JavaScript that calls that module
   reaches a build that does not contain the matching native code, the app
   crashes. Section 4 prevents this.
2. **No update can reach the current 0.1.0 installs.** `expo-updates` must be
   installed, prebuilt, and released inside a new `.aab` together with the
   signing certificate. Users receive updates only after they install that
   new build.
3. **iOS has no app yet.** `app.json` declares `"platforms": ["android"]`,
   there is no `ios/` directory, and the wallpaper feature uses an Android
   API that iOS does not supply. The protocol keys every request on
   `expo-platform`, so iOS needs no extra design work now.
4. **The repository has no CI.** Publishing is a local `pnpm` script.

## Scope

In scope: one production channel, rollback, and code signing.

Out of scope: multiple channels, staged percentage rollouts, an update
dashboard, and per-device targeting.

## 1. Architecture

The publish script does all expensive and all secret work. The Worker only
reads a key and returns stored bytes.

```
pnpm ota:publish                          Cloudflare
  |                                       ----------
  |-- expo export --------> dist/
  |-- hash each file
  |-- build manifest JSON string
  |-- sign it (private key, local) 
  |-- upload assets ------------------->  R2   assets/<hash>
  |-- verify all assets present
  `-- PUT /api/pointer ---------------->  KV   pointer:<platform>:<runtimeVersion>

app on launch --- GET /api/manifest --->  Worker --> KV  (echo stored bytes)
              --- GET /assets/<hash> -->  Worker --> R2
```

### Why the script signs, and not the Worker

The private key never leaves the developer machine. A person who takes over
the Worker or the R2 bucket still cannot forge an update, which is the only
reason to sign at all.

The Worker also never assembles or parses the manifest. It returns the exact
bytes that were signed, so the signature and the body cannot drift apart.

The cost of this choice: the manifest is fixed when it is published. A staged
percentage rollout would need the Worker to build manifests per request. That
is out of scope.

## 2. Layout

```
scripts/ota-publish.mjs      # export, hash, sign, upload, set pointer
scripts/ota-rollback.mjs     # set pointer to an older update, or to embedded
ota/worker/                  # wrangler project: src/index.ts and tests
certs/certificate.pem        # PUBLIC certificate, committed, embedded in build
```

The private key is not in the repository. The scripts read its path from
`OTA_PRIVATE_KEY_PATH`.

`scripts/*.mjs` matches the existing convention of `verify-data.mjs` and
`verify-native.mjs`.

## 3. Data model

### R2 — immutable, content-addressed

```
assets/<sha256-base64url>
```

The JavaScript bundle and every asset use the same layout. A file uploads
once. No publish can write over a file that an older update still needs.

### KV — one pointer for each build type

```
pointer:<platform>:<runtimeVersion>
  -> { kind: "update",   manifestBody: string, signature: string, updateId: string }
  |  { kind: "rollback", directiveBody: string, signature: string }

update:<updateId>
  -> { manifestBody: string, signature: string, platform, runtimeVersion, createdAt }
```

`manifestBody` is the exact string that was signed. The Worker does not parse
it.

The `update:<updateId>` archive lets a rollback recover an earlier manifest.
The archive is immutable: a rollback reads it and never writes it. The stored
signature is not replayed, for the `commitTime` reason in section 6.

## 4. runtimeVersion

`app.json` uses the fingerprint policy:

```json
"runtimeVersion": { "policy": "fingerprint" }
```

The fingerprint changes when the native project changes. An old build asks
with its own fingerprint, finds no pointer, and receives "nothing available".
This is what makes constraint 1 safe.

`scripts/ota-publish.mjs`:

- runs `npx expo-updates fingerprint:generate --platform android`
- stops with an error if the git worktree is dirty
- prints the fingerprint and the git SHA, so the developer can confirm that
  it matches the released binary

A fixed string such as `"runtimeVersion": "1"` was rejected. One forgotten
increment after a change to the Kotlin module sends a crash to every user.

## 5. Worker endpoints

| Route | Auth | Behavior |
| --- | --- | --- |
| `GET /api/manifest` | none | Reads `expo-platform` and `expo-runtime-version`. Returns `multipart/mixed` with a `manifest` part, or with a `directive` part. |
| `GET /assets/:hash` | none | Streams the object from R2 with `cache-control: public, max-age=31536000, immutable`. |
| `PUT /api/pointer` | bearer token | The only write path. The publish script calls it last. |

Asset uploads do not go through the Worker. The publish script uploads to R2
by shelling out to `wrangler r2 object put`, so no R2 access key or secret
exists anywhere in this system. The Worker needs no write access.

### Manifest response

Response headers include `expo-protocol-version: 1` and
`expo-sfv-version: 0`.

The `manifest` part carries an `expo-signature` part header in structured
field form:

```
expo-signature: sig="<base64>", keyid="root", alg="rsa-v1_5-sha256"
```

The Worker copies the stored signature into this header. It does no crypto.

## 6. Rollback

Two commands, for two different failures.

```
pnpm ota:rollback --to <updateId>   # a known good earlier update
pnpm ota:rollback --to embedded     # the bundle inside the installed binary
```

`--to <updateId>` reads `update:<updateId>`, parses the archived manifest, and
mints a **new** record from it: `createdAt` becomes now, `id` becomes a fresh
UUID, the result is stringified once, and that exact string is signed with the
local private key. Only the pointer changes; the archive stays untouched.

The archived record cannot be replayed verbatim. `expo-updates` orders updates
by `commitTime` and takes only a strictly newer one:
`LoaderSelectionPolicyFilterAware` returns
`newUpdate.commitTime.after(launchedUpdate.commitTime)`. An archived record
keeps its original `createdAt`, so serving it again would leave every device
already running the broken newer update exactly where it is, with no error and
no log line. Only a fresh install would take the older update.

The `id` must be fresh as well as the time. A device that once ran that update
still holds its `id` in the local update database, so the same `id` with a
different `commitTime` risks being deduplicated or conflicting. A new `id` is
unambiguously a new update to every client.

Signing again costs nothing: the private key is already on the machine that
runs a rollback, because `--to embedded` signs a directive there too.

`--to embedded` writes a `rollBackToEmbedded` directive. The script signs the
directive body locally, the same as a manifest. This recovers a build even
when no earlier update is good.

## 7. Error handling

The rule is fail-open. A broken update server must never degrade the app.

| Failure | Result |
| --- | --- |
| Worker down, or KV read error | The app keeps its current bundle. |
| No pointer for the requested runtimeVersion | `204 No Content`. The protocol reads this as "nothing available", so an old build starts normally. It is not a 404. |
| `expo-platform` or `expo-runtime-version` missing | 400. |
| Asset missing from R2 | 404. The client abandons the update and keeps its current bundle. |
| Publish interrupted part way | The pointer is written last, so it can never name a manifest whose assets are absent. |

The publish order is: upload every asset, confirm every asset is present,
then write the pointer.

## 8. Update behavior in the app

The app checks for an update on launch, downloads in the background, and
applies the update on the next launch. There is no prompt and no blocking
spinner, so a slow network cannot delay the splash screen.

## 9. Testing

| Target | Test |
| --- | --- |
| Worker | `vitest` with `@cloudflare/vitest-pool-workers`: header routing, the 204 "nothing available" response, byte-exact signature pass-through, the rollback directive, and 400 on missing headers. |
| Publish script | Hashing and manifest assembly against a fixture `dist/` directory. |
| Signing | A round trip: sign a fixture manifest, then verify it with `certs/certificate.pem`. This test catches key-format drift, which is the most probable silent failure. |

These tests join the existing `pnpm verify` chain.

## 10. Secrets

| Name | Where | Use |
| --- | --- | --- |
| `OTA_PRIVATE_KEY_PATH` | local environment | Path to the signing key, outside the repository. |
| `OTA_PUBLISH_TOKEN` | Worker secret and local environment | Bearer token for `PUT /api/pointer`. |
| `OTA_WORKER_URL` | local environment | The deployed Worker origin, no trailing slash. The publish script refuses to run if the URL has a trailing slash, or if its origin differs from `expo.updates.url` in `app.json`. |
| `CLOUDFLARE_API_TOKEN` | local environment | Used by the wrangler CLI to upload assets to R2. Optional after `wrangler login`. |

## 11. Phases

1. Install `expo-updates`. Configure the fingerprint policy and code signing.
   Prebuild. Confirm the app still starts. No server is involved.
2. Build the Worker with R2 and KV, and its tests.
3. Build `ota-publish.mjs` and `ota-rollback.mjs`, and their tests.
4. Release a new `.aab` that contains the certificate and the update URL.
   Over-the-air updates do nothing until this build reaches users, and it
   carries a store review delay.
5. Publish a small JavaScript change. Confirm that a device applies it.

## 12. To confirm during implementation

These are protocol details to read from Expo's official
`custom-expo-updates-server` example, not decisions:

- the `dist/metadata.json` layout for SDK 57
- how the `hash` and `key` fields of an asset are derived
- whether a self-signed certificate needs a `certificate_chain` part
