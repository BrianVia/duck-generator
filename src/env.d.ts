/// <reference path="../.astro/types.d.ts" />
/// <reference types="astro/client" />

type PagesFunction<Env = unknown> = (context: {
  request: Request;
  env: Env;
  params: Record<string, string>;
  waitUntil: (promise: Promise<unknown>) => void;
}) => Response | Promise<Response>;