import type { WorkspaceGraphDto } from '@abnt/protocol';

export interface GraphPoint {
  readonly x: number;
  readonly y: number;
}

const hash = (value: string): number => {
  let result = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    result ^= value.charCodeAt(index);
    result = Math.imul(result, 16777619);
  }
  return result >>> 0;
};

/**
 * F58: layout determinístico e puramente visual. O grafo continua derivado no
 * Workspace Service; não há estado de física, biblioteca externa nem dado
 * persistido. O custo é limitado para manter o diálogo responsivo em vaults
 * grandes.
 */
export function forceDirectedLayout(graph: WorkspaceGraphDto, width: number, height: number): ReadonlyMap<string, GraphPoint> {
  const nodes = graph.nodes.slice(0, 180);
  const visible = new Set(nodes.map((node) => node.id));
  const edges = graph.edges.filter((edge) => visible.has(edge.from) && visible.has(edge.to));
  const points = new Map<string, { x: number; y: number; vx: number; vy: number }>();
  const padding = 34;
  for (const node of nodes) {
    const value = hash(node.id);
    points.set(node.id, {
      x: padding + ((value & 0xffff) / 0xffff) * (width - padding * 2),
      y: padding + (((value >>> 16) & 0xffff) / 0xffff) * (height - padding * 2),
      vx: 0,
      vy: 0,
    });
  }
  const iterations = Math.min(150, 55 + nodes.length * 2);
  const repulsion = 7_500 / Math.max(nodes.length, 1);
  const idealLength = Math.max(68, Math.min(145, Math.sqrt((width * height) / Math.max(nodes.length, 1)) * 1.15));

  for (let iteration = 0; iteration < iterations; iteration += 1) {
    const cooling = 1 - iteration / iterations;
    for (let left = 0; left < nodes.length; left += 1) {
      const a = points.get(nodes[left]?.id ?? '');
      if (a === undefined) continue;
      for (let right = left + 1; right < nodes.length; right += 1) {
        const b = points.get(nodes[right]?.id ?? '');
        if (b === undefined) continue;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const distanceSquared = Math.max(80, dx * dx + dy * dy);
        const strength = repulsion / distanceSquared;
        const distance = Math.sqrt(distanceSquared);
        const fx = (dx / distance) * strength;
        const fy = (dy / distance) * strength;
        a.vx -= fx; a.vy -= fy;
        b.vx += fx; b.vy += fy;
      }
    }
    for (const edge of edges) {
      const from = points.get(edge.from);
      const to = points.get(edge.to);
      if (from === undefined || to === undefined) continue;
      const dx = to.x - from.x;
      const dy = to.y - from.y;
      const distance = Math.max(1, Math.hypot(dx, dy));
      const strength = (distance - idealLength) * 0.014 * cooling;
      const fx = (dx / distance) * strength;
      const fy = (dy / distance) * strength;
      from.vx += fx; from.vy += fy;
      to.vx -= fx; to.vy -= fy;
    }
    for (const point of points.values()) {
      point.vx *= 0.78; point.vy *= 0.78;
      point.x = Math.max(padding, Math.min(width - padding, point.x + point.vx * cooling * 8));
      point.y = Math.max(padding, Math.min(height - padding, point.y + point.vy * cooling * 8));
    }
  }
  return new Map([...points].map(([id, point]) => [id, { x: point.x, y: point.y }]));
}
