import { env } from 'cloudflare:workers';
import { generateResponse, type GenerationEnv } from '@/lib/generation';
export async function POST(request: Request) {
  return generateResponse(request, env as GenerationEnv);
}
