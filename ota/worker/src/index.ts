export type Env = {
  UPDATES: KVNamespace;
  ASSETS: R2Bucket;
  OTA_PUBLISH_TOKEN: string;
};

export default {
  async fetch(): Promise<Response> {
    return new Response('not found', { status: 404 });
  },
};
