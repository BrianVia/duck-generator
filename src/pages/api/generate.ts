export const prerender = false;

import type { APIRoute } from 'astro';

interface GenerateRequest {
  apiKey: string;
  provider: 'openai' | 'google';
  model: string;
  prompt: string;
}

export const POST: APIRoute = async ({ request }) => {
  try {
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
      const requestBody: any = {
        model: model,
        prompt: prompt,
        n: 1,
        size: '1024x1024'
      };
      
      // Only add response_format for DALL-E models
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
      console.log('OpenAI response:', JSON.stringify(data, null, 2));
      
      // Handle different response formats
      if (data.data && data.data[0]) {
        imageUrl = data.data[0].url || data.data[0].b64_json;
        if (data.data[0].b64_json) {
          imageUrl = `data:image/png;base64,${data.data[0].b64_json}`;
        }
      } else {
        throw new Error('Unexpected response format from OpenAI');
      }

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