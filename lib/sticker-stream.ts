import type { Sticker } from './stickers';
import { t, type Lang } from './i18n.ts';
export type StickerEvent =
  | { type: 'variant'; index: number; sticker: Sticker }
  | { type: 'progress'; index: number }
  | { type: 'error'; index: number; message: string }
  | { type: 'complete' | 'start' | 'ping' };
/** A batch completes once; network arrival order never becomes the design order. */
export async function readStickerBatch(
  stream: ReadableStream<Uint8Array>,
  onEvent: (event: StickerEvent, ordered: Sticker[]) => void,
  signal?: AbortSignal,
  lang: Lang = 'en',
) {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  const variants = new Map<number, Sticker>();
  let buffer = '',
    complete = false;
  const ordered = () =>
    [...variants.entries()].sort(([a], [b]) => a - b).map(([, s]) => s);
  const consume = (line: string) => {
    if (!line.trim()) return;
    const event = JSON.parse(line) as StickerEvent;
    if (event.type === 'variant') {
      if (
        !Number.isInteger(event.index) ||
        event.index < 0 ||
        event.index > 3 ||
        !event.sticker?.id ||
        !event.sticker.image
      )
        throw Error(t(lang, 'stream.invalid'));
      variants.set(event.index, event.sticker);
    }
    if (event.type === 'complete') complete = true;
    onEvent(event, ordered());
  };
  const abort = () => {
    void reader.cancel().catch(() => {});
  };
  signal?.addEventListener('abort', abort, { once: true });
  try {
    while (true) {
      signal?.throwIfAborted();
      const { value, done } = await reader.read();
      signal?.throwIfAborted();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      lines.forEach(consume);
    }
    buffer += decoder.decode();
    if (buffer.trim()) consume(buffer);
    if (!complete) throw Error(t(lang, 'stream.endedEarly'));
    return ordered();
  } finally {
    signal?.removeEventListener('abort', abort);
    reader.releaseLock();
  }
}
