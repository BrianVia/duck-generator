export const onRequestPost = async (context) => {
  try {
    const request = context.request;
    const body = await request.json();
    
    const { apiKey, provider, model, prompt } = body;
    
    if (!apiKey || !provider || !model || !prompt) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    let imageUrl;
    let storedKey;

    if (provider === 'openai') {
      const requestBody = {
        model: model,
        prompt: prompt,
        n: 1,
        size: '1024x1024'
      };
      
      // Only add response_format for DALL-E models (not gpt-image-1)
      if (model === 'dall-e-2' || model === 'dall-e-3') {
        requestBody.response_format = 'url';
      }

      const response = await fetch('https://api.openai.com/v1/images/generations', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const error = await response.json();
        return new Response(JSON.stringify({ error: error.error?.message || 'OpenAI API error' }), {
          status: response.status,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const data = await response.json();
      imageUrl = data.data[0].url;

    } else if (provider === 'google') {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateImages?key=${apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: prompt,
          number_of_images: 1
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        return new Response(JSON.stringify({ error: error.error?.message || 'Google API error' }), {
          status: response.status,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const data = await response.json();
      
      // Convert base64 to data URL
      const imageBytes = data.generated_images[0].image.image_bytes;
      imageUrl = `data:image/png;base64,${imageBytes}`;

    } else {
      return new Response(JSON.stringify({ error: 'Invalid provider' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const bucket = context.env.DUCK_IMAGES;
    try {
      if (bucket) {
        let data;
        if (imageUrl.startsWith('data:')) {
          const base64 = imageUrl.split(',')[1];
          data = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
        } else {
          const imgResp = await fetch(imageUrl);
          data = new Uint8Array(await imgResp.arrayBuffer());
        }
        storedKey = `duck-${Date.now()}.png`;
        await bucket.put(storedKey, data, { httpMetadata: { contentType: 'image/png' } });
      }
    } catch (e) {
      console.error('R2 upload error:', e);
    }

    return new Response(JSON.stringify({ imageUrl, storedKey }), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST',
        'Access-Control-Allow-Headers': 'Content-Type'
      }
    });

  } catch (error) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

export const onRequestOptions = async () => {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
};