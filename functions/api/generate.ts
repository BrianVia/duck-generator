interface GenerateRequest {
  apiKey: string;
  provider: 'openai' | 'google';
  model: string;
  prompt: string;
}

interface OpenAIResponse {
  data: Array<{
    url: string;
  }>;
}

interface GoogleResponse {
  generated_images: Array<{
    image: {
      image_bytes: string;
    };
  }>;
}

export const onRequestPost: PagesFunction = async (context) => {
  try {
    const request = context.request;
    const body: GenerateRequest = await request.json();
    
    const { apiKey, provider, model, prompt } = body;
    
    if (!apiKey || !provider || !model || !prompt) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    let imageUrl: string;

    if (provider === 'openai') {
      const response = await fetch('https://api.openai.com/v1/images/generations', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: model,
          prompt: prompt,
          n: 1,
          size: '1024x1024',
          response_format: 'url'
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        return new Response(JSON.stringify({ error: error.error?.message || 'OpenAI API error' }), {
          status: response.status,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const data: OpenAIResponse = await response.json();
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

      const data: GoogleResponse = await response.json();
      
      const imageBytes = data.generated_images[0].image.image_bytes;
      imageUrl = `data:image/png;base64,${imageBytes}`;

    } else {
      return new Response(JSON.stringify({ error: 'Invalid provider' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ imageUrl }), {
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

export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
};