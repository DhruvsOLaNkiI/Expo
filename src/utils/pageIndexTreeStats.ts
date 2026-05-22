/** Summarize a PageIndex tree for CMS / status API (node counts, size, sample titles). */

export type PageIndexTreeStats = {
  topLevelSections: number;
  totalNodes: number;
  jsonSizeKb: number;
  sampleTitles: string[];
};

function normalizeTreeNodes(structure: unknown): unknown[] {
  if (Array.isArray(structure)) return structure;
  if (structure && typeof structure === 'object') {
    const inner = (structure as { structure?: unknown[] }).structure;
    if (Array.isArray(inner)) return inner;
  }
  return [];
}

function walkNodes(
  nodes: unknown[],
  acc: { totalNodes: number; titles: string[] },
  maxTitles: number,
): void {
  for (const raw of nodes) {
    if (!raw || typeof raw !== 'object') continue;
    const n = raw as Record<string, unknown>;
    acc.totalNodes += 1;
    if (typeof n.title === 'string' && acc.titles.length < maxTitles) {
      acc.titles.push(n.title.trim().slice(0, 80));
    }
    if (Array.isArray(n.nodes) && n.nodes.length) {
      walkNodes(n.nodes as unknown[], acc, maxTitles);
    }
  }
}

export function summarizePageIndexTree(structure: unknown): PageIndexTreeStats | null {
  const top = normalizeTreeNodes(structure);
  if (!top.length) return null;

  const acc = { totalNodes: 0, titles: [] as string[] };
  walkNodes(top, acc, 6);

  let jsonSizeKb = 0;
  try {
    jsonSizeKb = Math.round((JSON.stringify(structure).length / 1024) * 10) / 10;
  } catch {
    jsonSizeKb = 0;
  }

  return {
    topLevelSections: top.length,
    totalNodes: acc.totalNodes,
    jsonSizeKb,
    sampleTitles: acc.titles,
  };
}
