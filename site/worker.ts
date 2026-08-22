// Phase 1 serves everything from Static Assets. This Worker exists so that a
// Worker script is present for the Custom Domain binding, and so Phase 3 can
// add server-side routes without changing the deployment shape.
//
// run_worker_first is deliberately NOT set: asset requests are served directly
// by the asset layer and never invoke this Worker.
export interface Env {
  ASSETS: Fetcher;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;
