export async function onRequest() {
  return new Response(JSON.stringify({ message: 'Test endpoint working!' }), {
    headers: { 'Content-Type': 'application/json' }
  });
}