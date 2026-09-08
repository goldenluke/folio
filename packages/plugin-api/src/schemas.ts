import { diagnosticDtoSchema, resolvedDocumentDtoSchema } from '@abnt/protocol';
import { z } from 'zod';

import type {
  AbntLintPluginInfo,
  PluginLintRequestMessage,
  PluginLintResponseMessage,
  PluginReadyMessage,
} from './model.js';

const pluginInfoSchema = z.object({
  id: z.string().min(1),
  version: z.string().min(1),
  norma: z.object({ id: z.string().min(1), version: z.string().min(1) }).optional(),
}) as z.ZodType<AbntLintPluginInfo>;

export const pluginReadyMessageSchema = z.object({
  version: z.number().int().positive(),
  type: z.literal('abnt-plugin/ready'),
  plugin: pluginInfoSchema,
}) as z.ZodType<PluginReadyMessage>;

export const pluginLintRequestMessageSchema = z.object({
  version: z.number().int().positive(),
  type: z.literal('abnt-plugin/lint'),
  requestId: z.string().min(1),
  document: resolvedDocumentDtoSchema,
}) as z.ZodType<PluginLintRequestMessage>;

export const pluginLintResponseMessageSchema = z.discriminatedUnion('ok', [
  z.object({
    version: z.number().int().positive(),
    type: z.literal('abnt-plugin/lint-result'),
    requestId: z.string().min(1),
    ok: z.literal(true),
    diagnostics: z.array(diagnosticDtoSchema),
  }),
  z.object({
    version: z.number().int().positive(),
    type: z.literal('abnt-plugin/lint-result'),
    requestId: z.string().min(1),
    ok: z.literal(false),
    error: z.string(),
  }),
]) as z.ZodType<PluginLintResponseMessage>;
