import type { Env } from './index';

// Lets `cloudflare:test`'s `env` in test files see the bindings this Worker
// declares (UPDATES, ASSETS, OTA_PUBLISH_TOKEN), instead of an empty type.
declare module 'cloudflare:test' {
  interface ProvidedEnv extends Env {}
}
