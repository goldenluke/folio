export { applyTextPatches, mapProcessedOffsetToOriginal } from './text-patch.js';
export type { TextPatch, TextSpanMapping, PatchedText } from './text-patch.js';

export { CompositeSourceMapBuilder, locateInComposite, locateRangeInComposite } from './composite-source-map.js';
export type {
  CompositeSourceSegment,
  CompositeSourceMap,
  CompositeOrigin,
  CompositeRangeOrigin,
} from './composite-source-map.js';
