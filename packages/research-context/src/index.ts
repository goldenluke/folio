export interface ResearchContext {
  readonly browserOrigin?: string;
  readonly browserTitle?: string;
  readonly projectId?: string;
  readonly evidenceSynthesisId?: string;
  readonly searchStrategyId?: string;
  readonly searchRunId?: string;
  readonly recordId?: string;
  readonly workId?: string;
  readonly referenceId?: string;
  readonly artifactId?: string;
}

const keys = ['projectId', 'evidenceSynthesisId', 'searchStrategyId', 'searchRunId', 'recordId', 'workId', 'referenceId', 'artifactId'] as const;
export type ResearchContextPatch = Partial<ResearchContext>;

const valid = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;

export const createResearchContext = (patch: ResearchContextPatch = {}): ResearchContext => {
  const result: Record<string, string> = {};
  for (const key of keys) if (valid(patch[key])) result[key] = patch[key]!.trim();
  return result;
};

export const updateResearchContext = (current: ResearchContext, patch: ResearchContextPatch): ResearchContext => createResearchContext({ ...current, ...patch });

export const clearResearchContext = (): ResearchContext => ({});

export const hasResearchContext = (context: ResearchContext): boolean => keys.some((key) => valid(context[key]));
