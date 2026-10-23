import { env } from 'cloudflare:workers';
export function GET() {
  const vars = env as { OPENAI_API_KEY?: string };
  return Response.json(
    { configured: Boolean(vars.OPENAI_API_KEY) },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
