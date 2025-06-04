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
  
  console.log('Feed Debug:', {
    hasBucket: !!bucket,
    envKeys: Object.keys(context.env || {}),
    bucketType: bucket ? typeof bucket : 'undefined'
  });
  
  if (!bucket) {
    console.log('No R2 bucket available - returning empty array');
    return new Response(JSON.stringify({ 
      images: [], 
      debug: { 
        message: 'No R2 bucket binding found',
        envKeys: Object.keys(context.env || {})
      }
    }), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }

  const list = await bucket.list();
  const objects = list.objects.sort((a, b) => b.uploaded.getTime() - a.uploaded.getTime()).slice(0, 20);

  console.log('R2 Bucket contents:', {
    totalObjects: list.objects.length,
    objectKeys: list.objects.map(obj => obj.key),
    truncated: list.truncated
  });

  const images: string[] = [];
  
  // Using custom domain for R2 bucket
  const R2_PUBLIC_URL = 'https://images.duckgenerator.com';
  
  for (const obj of objects) {
    // Just return the public URL - much faster than base64
    images.push(`${R2_PUBLIC_URL}/${obj.key}`);
  }
  
  // Option 2: If you prefer base64 (slower, no CDN benefits)
  // for (const obj of objects) {
  //   const file = await bucket.get(obj.key);
  //   if (file) {
  //     const data = await file.arrayBuffer();
  //     const uint8Array = new Uint8Array(data);
  //     let binaryString = '';
  //     for (let i = 0; i < uint8Array.length; i++) {
  //       binaryString += String.fromCharCode(uint8Array[i]);
  //     }
  //     const b64 = btoa(binaryString);
  //     const contentType = file.httpMetadata?.contentType || 'image/png';
  //     images.push(`data:${contentType};base64,${b64}`);
  //   }
  // }

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