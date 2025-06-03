# Duck Generator API Test Payloads

## Test Instructions

1. Start the development server with Wrangler (for API to work):
   ```bash
   npm run pages:dev
   ```

2. The website should be available at `http://localhost:3000`

3. You can test the API endpoint at `http://localhost:4321/api/generate` with the following payloads:

## Sample API Payloads

### OpenAI DALL-E 3 Test
```json
{
  "apiKey": "YOUR_OPENAI_API_KEY",
  "provider": "openai",
  "model": "dall-e-3",
  "prompt": "Cartoon style image of 5 ducks coding on laptops in a cyberpunk city setting with neon effects, wearing cool sunglasses, optimized for use as a video call background"
}
```

### OpenAI DALL-E 2 Test
```json
{
  "apiKey": "YOUR_OPENAI_API_KEY",
  "provider": "openai",
  "model": "dall-e-2",
  "prompt": "Realistic style image of 3 ducks swimming peacefully in a serene lake setting, optimized for use as a video call background"
}
```

### Google Imagen Test
```json
{
  "apiKey": "YOUR_GOOGLE_API_KEY",
  "provider": "google",
  "model": "imagen-3.0-generate-002",
  "prompt": "Pixel art style image of 10 ducks dancing in outer space with stars and planets with rainbow colors, wearing fun hats, optimized for use as a video call background"
}
```

## Testing with cURL

```bash
# OpenAI test
curl -X POST http://localhost:4321/api/generate \
  -H "Content-Type: application/json" \
  -d '{
    "apiKey": "YOUR_OPENAI_API_KEY",
    "provider": "openai",
    "model": "dall-e-3",
    "prompt": "Cartoon style image of 5 ducks coding on laptops in a cyberpunk city setting"
  }'

# Google test
curl -X POST http://localhost:4321/api/generate \
  -H "Content-Type: application/json" \
  -d '{
    "apiKey": "YOUR_GOOGLE_API_KEY",
    "provider": "google",
    "model": "imagen-3.0-generate-002",
    "prompt": "Pixel art style image of ducks in space"
  }'
```

## Expected Response

Success:
```json
{
  "imageUrl": "https://generated-image-url.com/..."
}
```

Error:
```json
{
  "error": "Error message here"
}
```

## UI Testing

1. Open `http://localhost:4321` in your browser
2. Enter your API key (OpenAI or Google)
3. Select provider and model
4. Configure duck settings:
   - Number of ducks
   - Activity
   - Environment
   - Style
   - Special effects
   - Optional accessories
5. Click "Generate Duck Background!"
6. The generated image should appear below the form
7. You can download the image or generate another one

## Notes

- API keys are not stored - they're only used for the single request
- The API endpoint runs as a Cloudflare Worker function
- Images are generated at 1024x1024 resolution for video backgrounds
- Make sure you have valid API keys for testing