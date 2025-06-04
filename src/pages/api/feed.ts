import type { APIRoute } from 'astro';

export const GET: APIRoute = async ({ locals }) => {
  const runtime = locals.runtime as any;
  const bucket = runtime?.env?.DUCK_IMAGES;
  
  if (!bucket) {
    return new Response(JSON.stringify({ images: [] }), {
      headers: { 
        'Content-Type': 'application/json', 
        'Access-Control-Allow-Origin': '*' 
      }
    });
  }

  const list = await bucket.list();
  const objects = list.objects.sort((a: any, b: any) => b.uploaded - a.uploaded).slice(0, 20);

  const images: string[] = [];
  for (const obj of objects) {
    const file = await bucket.get(obj.key);
    if (file) {
      const data = await file.arrayBuffer();
      const b64 = btoa(String.fromCharCode(...new Uint8Array(data)));
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