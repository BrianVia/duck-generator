/// <reference types="@cloudflare/workers-types" />

interface Env {
  DUCK_IMAGES: R2Bucket;
}

interface GenerateRequest {
  apiKey: string;
  provider: "openai" | "google";
  model: string;
  prompt: string;
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

export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const request = context.request;
    const body: GenerateRequest = await request.json();

    const { apiKey, provider, model, prompt } = body;

    if (!apiKey || !provider || !model || !prompt) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    let imageUrl: string;

    if (provider === "openai") {
      const requestBody: any = {
        model: model,
        prompt: prompt,
        n: 1,
        size: "1024x1024",
      };

      // Only add response_format for DALL-E models (not gpt-image-1)
      if (model === "dall-e-2" || model === "dall-e-3") {
        requestBody.response_format = "url";
      }

      const response = await fetch("https://api.openai.com/v1/images/generations", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const error = (await response.json()) as { error?: { message?: string } };
        return new Response(JSON.stringify({ error: error.error?.message || "OpenAI API error" }), {
          status: response.status,
          headers: { "Content-Type": "application/json" },
        });
      }

      const data: any = await response.json();
      console.log("OpenAI response:", JSON.stringify(data, null, 2));

      // Handle different response formats
      if (data.data && data.data[0]) {
        imageUrl = data.data[0].url || data.data[0].b64_json;
        if (data.data[0].b64_json) {
          imageUrl = `data:image/png;base64,${data.data[0].b64_json}`;
        }
      } else {
        throw new Error("Unexpected response format from OpenAI");
      }
    } else if (provider === "google") {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateImages?key=${apiKey}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            prompt: prompt,
            number_of_images: 1,
          }),
        }
      );

      if (!response.ok) {
        const error = (await response.json()) as { error?: { message?: string } };
        return new Response(JSON.stringify({ error: error.error?.message || "Google API error" }), {
          status: response.status,
          headers: { "Content-Type": "application/json" },
        });
      }

      const data: GoogleResponse = await response.json();

      const imageBytes = data.generated_images[0].image.image_bytes;
      imageUrl = `data:image/png;base64,${imageBytes}`;
    } else {
      return new Response(JSON.stringify({ error: "Invalid provider" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Upload to R2 if bucket is available
    const bucket = context.env.DUCK_IMAGES;
    let storedKey: string | undefined;

    if (bucket && imageUrl) {
      try {
        let data: Uint8Array;
        if (imageUrl.startsWith("data:")) {
          const base64 = imageUrl.split(",")[1];
          data = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
        } else {
          const imgResp = await fetch(imageUrl);
          data = new Uint8Array(await imgResp.arrayBuffer());
        }
        storedKey = `duck-${Date.now()}.png`;
        await bucket.put(storedKey, data, {
          httpMetadata: { contentType: "image/png" },
          customMetadata: {
            prompt: prompt,
            provider: provider,
            model: model,
            generated: new Date().toISOString(),
          },
        });
        console.log(`Image uploaded to R2: ${storedKey}`);
      } catch (uploadError) {
        console.error("R2 upload error:", uploadError);
      }
    }

    return new Response(JSON.stringify({ imageUrl, storedKey }), {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });
  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};

export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
};
