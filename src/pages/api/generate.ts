export const prerender = false;

import type { APIRoute } from 'astro';

interface GenerateRequest {
  apiKey: string;
  provider: 'openai' | 'google';
  model: string;
  prompt: string;
}

export const POST: APIRoute = async ({ request, locals }) => {
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

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 180000); // 3 minutes

      const response = await fetch('https://api.openai.com/v1/images/generations', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal
      }).finally(() => clearTimeout(timeoutId));

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
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 180000); // 3 minutes

      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateImages?key=${apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: prompt,
          number_of_images: 1
        }),
        signal: controller.signal
      }).finally(() => clearTimeout(timeoutId));

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

    // Upload to R2 if bucket is available
    const runtime = locals.runtime as any;
    const bucket = runtime?.env?.DUCK_IMAGES;
    
    if (bucket && imageUrl) {
      try {
        let imageData: ArrayBuffer;
        
        // Handle different image URL formats
        if (imageUrl.startsWith('data:')) {
          // Extract base64 data
          const base64Data = imageUrl.split(',')[1];
          const binaryString = atob(base64Data);
          const bytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }
          imageData = bytes.buffer;
        } else {
          // Fetch image from URL
          const imageResponse = await fetch(imageUrl);
          imageData = await imageResponse.arrayBuffer();
        }
        
        // Generate unique filename
        const timestamp = Date.now();
        const filename = `duck-${timestamp}.png`;
        
        // Upload to R2
        await bucket.put(filename, imageData, {
          httpMetadata: {
            contentType: 'image/png'
          },
          customMetadata: {
            prompt: prompt,
            provider: provider,
            model: model,
            generated: new Date().toISOString()
          }
        });
        
        console.log(`Image uploaded to R2: ${filename}`);
      } catch (uploadError) {
        console.error('Failed to upload to R2:', uploadError);
        // Don't fail the request if R2 upload fails
      }
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