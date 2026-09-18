import { diagnosticDtoSchema, publicationDocumentDtoSchema, resolvedDocumentDtoSchema } from '@abnt/protocol';
import { z } from 'zod';

import type {
  AbntLintPluginInfo,
  PluginLintRequestMessage,
  PluginLintResponseMessage,
  PluginReadyMessage,
  FolioPluginManifest,
  PluginCommandRequestMessage,
  PluginCommandResponseMessage,
  PluginExportRequestMessage,
  PluginExportResponseMessage,
} from './model.js';

const pluginCapabilitySchema = z.enum(['lint', 'commands', 'views', 'language-diagnostics', 'export', 'read-document', 'read-library', 'network', 'write-operational-state', 'themes', 'panels', 'home-blocks', 'page-properties', 'view-renderers']);
const pluginCommandSchema = z.object({ id: z.string().min(1), title: z.string().min(1) });
const pluginViewSchema = z.object({ id: z.string().min(1), title: z.string().min(1), body: z.string().max(10_000) });
const pluginExportSchema = z.object({ id: z.string().min(1), title: z.string().min(1), extension: z.string().regex(/^[a-z0-9]+$/iu), mimeType: z.string().min(1) });
const contributionSchema = z.object({ id: z.string().min(1), title: z.string().min(1) });
const settingSchema = z.object({ id: z.string().min(1), label: z.string().min(1), type: z.enum(['string', 'boolean', 'enum', 'number']), default: z.union([z.string(), z.boolean(), z.number()]).optional(), options: z.array(z.string().min(1)).optional() });
export const folioPluginManifestSchema = z.object({ id: z.string().min(1), version: z.string().min(1), apiVersion: z.literal(1), entry: z.string().min(1), capabilities: z.array(pluginCapabilitySchema), folioVersion: z.object({ min: z.string().min(1).optional(), max: z.string().min(1).optional() }).optional(), settings: z.array(settingSchema).optional(), commands: z.array(pluginCommandSchema).optional(), views: z.array(pluginViewSchema).optional(), exports: z.array(pluginExportSchema).optional(), projectContributions: z.array(z.object({ id: z.string().min(1), title: z.string().min(1), metric: z.string().min(1) })).optional(), intakeProviders: z.array(contributionSchema).optional(), bibliographyAdapters: z.array(contributionSchema).optional(), searchProviders: z.array(contributionSchema).optional(), publicationProfiles: z.array(contributionSchema).optional(), templates: z.array(contributionSchema).optional(), themes: z.array(z.object({ id: z.string().min(1), title: z.string().min(1), tokens: z.record(z.string().min(1), z.string().max(80)) })).optional(), panels: z.array(pluginViewSchema).optional(), homeBlocks: z.array(pluginViewSchema).optional(), pageProperties: z.array(z.object({ id: z.string().min(1), label: z.string().min(1), type: z.enum(['text', 'select', 'date']) })).optional(), viewRenderers: z.array(z.object({ id: z.string().min(1), title: z.string().min(1), source: z.string().min(1) })).optional() }).superRefine((value, context) => {
  if (value.commands !== undefined && !value.capabilities.includes('commands')) context.addIssue({ code: 'custom', message: 'commands exige capability commands.' });
  if (value.views !== undefined && !value.capabilities.includes('views')) context.addIssue({ code: 'custom', message: 'views exige capability views.' });
  if (value.exports !== undefined && !value.capabilities.includes('export')) context.addIssue({ code: 'custom', message: 'exports exige capability export.' });
  for (const [field, capability] of [['themes', 'themes'], ['panels', 'panels'], ['homeBlocks', 'home-blocks'], ['pageProperties', 'page-properties'], ['viewRenderers', 'view-renderers']] as const) if (value[field] !== undefined && !value.capabilities.includes(capability)) context.addIssue({ code: 'custom', message: `${field} exige capability ${capability}.` });
  for (const setting of value.settings ?? []) if (setting.type === 'enum' && (setting.options?.length ?? 0) === 0) context.addIssue({ code: 'custom', message: `setting enum ${setting.id} exige options.` });
}) as z.ZodType<FolioPluginManifest>;

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

const commandContextSchema = z.object({ activeFileId: z.string().min(1).optional(), activeRevision: z.number().int().nonnegative().optional() });
const commandResultSchema = z.object({ kind: z.enum(['notice', 'open-view', 'open-intake', 'open-template', 'open-structured-research']), message: z.string().optional(), viewId: z.string().min(1).optional(), intakeFormat: z.enum(['bibtex', 'ris', 'csl-json']).optional(), templateKind: z.enum(['article', 'institutional-article', 'tcc', 'institutional-tcc', 'dissertation', 'thesis', 'abstract', 'reading-note', 'research-project']).optional() });
export const pluginCommandRequestMessageSchema = z.object({ version: z.number().int().positive(), type: z.literal('abnt-plugin/command'), requestId: z.string().min(1), commandId: z.string().min(1), context: commandContextSchema }) as z.ZodType<PluginCommandRequestMessage>;
export const pluginCommandResponseMessageSchema = z.discriminatedUnion('ok', [z.object({ version: z.number().int().positive(), type: z.literal('abnt-plugin/command-result'), requestId: z.string().min(1), ok: z.literal(true), result: commandResultSchema }), z.object({ version: z.number().int().positive(), type: z.literal('abnt-plugin/command-result'), requestId: z.string().min(1), ok: z.literal(false), error: z.string() })]) as z.ZodType<PluginCommandResponseMessage>;
export const pluginExportRequestMessageSchema = z.object({ version: z.number().int().positive(), type: z.literal('abnt-plugin/export'), requestId: z.string().min(1), exportId: z.string().min(1), publication: publicationDocumentDtoSchema }) as z.ZodType<PluginExportRequestMessage>;
export const pluginExportResponseMessageSchema = z.discriminatedUnion('ok', [z.object({ version: z.number().int().positive(), type: z.literal('abnt-plugin/export-result'), requestId: z.string().min(1), ok: z.literal(true), result: z.object({ content: z.string() }) }), z.object({ version: z.number().int().positive(), type: z.literal('abnt-plugin/export-result'), requestId: z.string().min(1), ok: z.literal(false), error: z.string() })]) as z.ZodType<PluginExportResponseMessage>;
