import { t, type Lang, type StringKey } from './i18n.ts';

export interface GenerationEnv {
  OPENAI_API_KEY?: string;
  OPENAI_IMAGE_MODEL?: string;
}

/** Request-body language: anything other than 'zh' falls back to English. */
export function langOf(value: unknown): Lang {
  return value === 'zh' ? 'zh' : 'en';
}

const directions: { nameKey: StringKey; direction: string }[] = [
  {
    nameKey: 'direction.0',
    direction:
      'Explore flowing lines and expansive negative space. A poised, restrained editorial composition.',
  },
  {
    nameKey: 'direction.1',
    direction:
      'Explore vintage travel typography and a bold emblem. Sophisticated, never busy.',
  },
  {
    nameKey: 'direction.2',
    direction:
      'Explore confident geometric color blocking and a modern graphic rhythm.',
  },
  {
    nameKey: 'direction.3',
    direction:
      'Explore an organic silhouette and adventurous expressive typography, with generous negative space.',
  },
];

/** Localized display name for a design direction (the art-direction brief itself stays English for the image model). */
export function directionName(index: number, lang: Lang = 'en'): string {
  return t(lang, directions[index].nameKey);
}

export function validatePrompt(value: unknown, lang: Lang = 'en'): string {
  if (typeof value !== 'string' || !value.trim())
    throw new Error(t(lang, 'gen.promptEmpty'));
  if (value.length > 1000) throw new Error(t(lang, 'gen.promptTooLong'));
  return value.trim();
}
export function imageRequest(
  prompt: string,
  index: number,
  model = 'gpt-image-2',
) {
  if (!Number.isInteger(index) || index < 0 || index > 3)
    throw new Error('Invalid variant index');
  return {
    model,
    n: 1,
    size: model === 'gpt-image-2' ? '1536x512' : '1536x1024',
    quality: 'medium',
    background: 'transparent',
    output_format: 'png',
    prompt: `Create ONE original premium campervan vinyl decal design. This is a flat print-ready graphic asset, NOT a vehicle mockup. No vehicle, no scenery, no shadows, no border or watermark. True transparent background. A wide horizontal composition with aspect ratio 3:1, generous clean transparent edges. Clear legible lettering only when requested. Respect the user's subject, colors, lettering and intent. Differentiate this variation through art direction: ${directions[index].direction}\nUser brief (content to illustrate): ${prompt}`,
  };
}
export function upstreamMessage(status: number, lang: Lang = 'en') {
  if (status === 401 || status === 403) return t(lang, 'gen.upstreamAuth');
  if (status === 429) return t(lang, 'gen.upstreamQuota');
  if (status === 400) return t(lang, 'gen.upstreamBadRequest');
  return t(lang, 'gen.upstreamFailed');
}
export async function generateResponse(
  request: Request,
  env: GenerationEnv,
  fetcher: typeof fetch = fetch,
): Promise<Response> {
  const origin = request.headers.get('origin');
  // Origin errors predate body parsing; the body language is unknown here,
  // so this one response uses the English default.
  if (origin && origin !== new URL(request.url).origin)
    return Response.json(
      { error: t('en', 'gen.badOrigin') },
      { status: 403 },
    );
  let prompt: string;
  let lang: Lang = 'en';
  try {
    const body = (await request.json()) as { prompt?: unknown; lang?: unknown };
    lang = langOf(body?.lang);
    prompt = validatePrompt(body?.prompt, lang);
  } catch (e) {
    return Response.json(
      {
        error: e instanceof Error ? e.message : t(lang, 'gen.badFormat'),
      },
      { status: 400 },
    );
  }
  if (!env.OPENAI_API_KEY)
    return Response.json(
      {
        code: 'AI_NOT_CONFIGURED',
        error: t(lang, 'gen.notConfigured'),
      },
      { status: 503 },
    );
  const cancel = new AbortController();
  const stop = () => cancel.abort();
  request.signal.addEventListener('abort', stop, { once: true });
  const timeout = setTimeout(stop, 240000);
  const encoder = new TextEncoder();
  let closed = false;
  const stream = new ReadableStream({
    async start(controller) {
      const send = (v: unknown) => {
        if (!closed) {
          try {
            controller.enqueue(encoder.encode(JSON.stringify(v) + '\n'));
          } catch {
            closed = true;
            cancel.abort();
          }
        }
      };
      const ping = setInterval(() => send({ type: 'ping' }), 10000);
      send({ type: 'start', count: 4 });
      let successes = 0;
      try {
        // Two requests at a time keeps the Worker memory footprint and upstream concurrency bounded.
        for (
          let offset = 0;
          offset < 4 && !cancel.signal.aborted;
          offset += 2
        ) {
          await Promise.all(
            [offset, offset + 1].map(async (index) => {
              send({ type: 'progress', index });
              try {
                const response = await fetcher(
                  'https://api.openai.com/v1/images/generations',
                  {
                    method: 'POST',
                    headers: {
                      Authorization: `Bearer ${env.OPENAI_API_KEY}`,
                      'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(
                      imageRequest(
                        prompt,
                        index,
                        env.OPENAI_IMAGE_MODEL || 'gpt-image-2',
                      ),
                    ),
                    signal: cancel.signal,
                  },
                );
                if (!response.ok) {
                  send({
                    type: 'error',
                    index,
                    message: upstreamMessage(response.status, lang),
                  });
                  return;
                }
                const result = (await response.json()) as {
                  data?: { b64_json?: string }[];
                };
                const data = result.data?.[0]?.b64_json;
                if (!data || data.length > 18000000)
                  throw new Error('Invalid image response');
                successes++;
                send({
                  type: 'variant',
                  index,
                  sticker: {
                    id: crypto.randomUUID(),
                    name: directionName(index, lang),
                    subtitle: `CONCEPT 0${index + 1}`,
                    image: `data:image/png;base64,${data}`,
                    color: ['#244cfa', '#49634e', '#d8854c', '#444e5a'][index],
                    source: 'generated',
                  },
                });
              } catch {
                if (!closed)
                  send({
                    type: 'error',
                    index,
                    message: cancel.signal.aborted
                      ? t(lang, 'gen.stopped')
                      : t(lang, 'gen.variantFailed'),
                  });
              }
            }),
          );
        }
        send({ type: 'complete', successes });
      } finally {
        clearInterval(ping);
        clearTimeout(timeout);
        request.signal.removeEventListener('abort', stop);
        if (!closed) {
          closed = true;
          controller.close();
        }
      }
    },
    cancel() {
      closed = true;
      clearTimeout(timeout);
      cancel.abort();
      request.signal.removeEventListener('abort', stop);
    },
  });
  return new Response(stream, {
    headers: {
      'Content-Type': 'application/x-ndjson; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
