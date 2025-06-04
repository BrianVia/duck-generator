/// <reference types="@cloudflare/workers-types" />

interface Env {
  DUCK_IMAGES: R2Bucket;
}

type PagesFunction<E = unknown> = (context: {
  request: Request;
  env: E;
  params: Record<string, string>;
  waitUntil: (promise: Promise<unknown>) => void;
  passThroughOnException: () => void;
  next: (input?: Request | string, init?: RequestInit) => Promise<Response>;
  data: Record<string, unknown>;
}) => Response | Promise<Response>;

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const bucket = context.env.DUCK_IMAGES;
  if (!bucket) {
    return new Response(JSON.stringify({ images: [] }), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }

  const list = await bucket.list();
  const objects = list.objects.sort((a, b) => b.uploaded.getTime() - a.uploaded.getTime()).slice(0, 20);

  const images: string[] = [];
  for (const obj of objects) {
    const file = await bucket.get(obj.key);
    if (file) {
      const data = await file.arrayBuffer();
      const uint8Array = new Uint8Array(data);
      let binaryString = '';
      for (let i = 0; i < uint8Array.length; i++) {
        binaryString += String.fromCharCode(uint8Array[i]);
      }
      const b64 = btoa(binaryString);
      const contentType = file.httpMetadata?.contentType || 'image/png';
      images.push(`data:${contentType};base64,${b64}`);
    }
  }

  return new Response(JSON.stringify({ images }), {
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    }
  });
};

export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    }
  });
};