export const onRequestGet = async (context) => {
  const bucket = context.env.DUCK_IMAGES;
  if (!bucket) {
    return new Response(JSON.stringify({ images: [] }), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }

  const list = await bucket.list();
  const objects = list.objects.sort((a, b) => b.uploaded - a.uploaded).slice(0, 20);

  const images = [];
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

export const onRequestOptions = async () => {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    }
  });
};
