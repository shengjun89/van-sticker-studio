'use client';
import { useEffect, useRef } from 'react';
import { t, type Lang } from '@/lib/i18n';
type Actions = {
  read: () => unknown;
  generate: (prompt: string, signal?: AbortSignal) => Promise<unknown>;
  apply: (id: string) => Promise<unknown>;
  setParts: (parts: Record<string, boolean>) => Promise<unknown>;
  setView: (view: string) => void;
};
type Tool = {
  name: string;
  title: string;
  description: string;
  inputSchema: object;
  annotations?: object;
  execute: (input: unknown, options?: { signal?: AbortSignal }) => unknown;
};
type Context = {
  registerTool: (tool: Tool, options?: { signal: AbortSignal }) => unknown;
};
const record = (v: unknown): Record<string, unknown> => {
  if (!v || typeof v !== 'object' || Array.isArray(v))
    throw Error('Expected an object');
  return v as Record<string, unknown>;
};
export function useStudioTools(actions: Actions, lang: Lang = 'en') {
  const latest = useRef(actions);
  useEffect(() => {
    latest.current = actions;
  }, [actions]);
  useEffect(() => {
    const context = (document as Document & { modelContext?: Context })
      .modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    const schema = (properties: object, required: string[]) => ({
      type: 'object',
      properties,
      required,
      additionalProperties: false,
    });
    const tools: Tool[] = [
      {
        name: 'read_wrap_studio',
        title: t(lang, 'tool.read.title'),
        description:
          'Read available sticker choices, applied sticker, vehicle parts and AI readiness.',
        inputSchema: schema({}, []),
        annotations: { readOnlyHint: true, untrustedContentHint: true },
        execute: () => latest.current.read(),
      },
      {
        name: 'generate_sticker_options',
        title: t(lang, 'tool.generate.title'),
        description:
          'Submit a description to the configured OpenAI image service and show up to four new decal designs. Requires server AI configuration and makes paid generation requests.',
        inputSchema: schema(
          { prompt: { type: 'string', minLength: 1, maxLength: 1000 } },
          ['prompt'],
        ),
        annotations: { readOnlyHint: false, untrustedContentHint: true },
        execute: (v, options) => {
          const r = record(v);
          if (
            typeof r.prompt !== 'string' ||
            !r.prompt.trim() ||
            r.prompt.length > 1000
          )
            throw Error('Invalid prompt');
          return latest.current.generate(r.prompt, options?.signal);
        },
      },
      {
        name: 'apply_sticker_option',
        title: t(lang, 'tool.apply.title'),
        description:
          'Apply one existing option to both sides of the real 3D RV, including its movable door surfaces.',
        inputSchema: schema({ id: { type: 'string' } }, ['id']),
        annotations: { readOnlyHint: false, untrustedContentHint: false },
        execute: (v) => {
          const r = record(v);
          if (typeof r.id !== 'string') throw Error('Invalid option id');
          return latest.current.apply(r.id);
        },
      },
      {
        name: 'set_vehicle_parts',
        title: t(lang, 'tool.parts.title'),
        description:
          'Open or close named vehicle parts. Use ids from read_wrap_studio. The update uses the same visible animation as clicking the vehicle.',
        inputSchema: schema(
          {
            parts: {
              type: 'object',
              additionalProperties: { type: 'boolean' },
            },
          },
          ['parts'],
        ),
        annotations: { readOnlyHint: false, untrustedContentHint: false },
        execute: (v) => {
          const r = record(v);
          const parts = record(r.parts);
          if (Object.values(parts).some((v) => typeof v !== 'boolean'))
            throw Error('Part states must be boolean');
          return latest.current.setParts(parts as Record<string, boolean>);
        },
      },
      {
        name: 'set_vehicle_view',
        title: t(lang, 'tool.view.title'),
        description:
          'Move the camera to a requested vehicle view without changing the sticker.',
        inputSchema: schema(
          {
            view: {
              type: 'string',
              enum: ['hero', 'entry', 'driver', 'front', 'rear'],
            },
          },
          ['view'],
        ),
        annotations: { readOnlyHint: false, untrustedContentHint: false },
        execute: async (v) => {
          const r = record(v);
          if (typeof r.view !== 'string') throw Error('Invalid view');
          latest.current.setView(r.view);
          await new Promise((resolve) => setTimeout(resolve, 900));
          return { view: r.view };
        },
      },
    ];
    for (const tool of tools) {
      try {
        Promise.resolve(
          context.registerTool(tool, { signal: lifecycle.signal }),
        ).catch(() => {});
      } catch {
        /* Unsupported experimental registry must not affect the working UI. */
      }
    }
    return () => lifecycle.abort();
    // Re-register when the language changes so tool titles follow the UI.
  }, [lang]);
}
