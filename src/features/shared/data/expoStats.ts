import {
  buildExpoDeveloperCatalog,
  type ExpoDeveloper,
  type PropertyTypeChoice,
} from './helpDeskCatalog';
import type { BoothLayoutPatch } from './boothLayouts';

export type ExpoCatalogStats = {
  developerCount: number;
  residentialDeveloperCount: number;
  commercialDeveloperCount: number;
  totalProjects: number;
  newLaunchProjectCount: number;
  developerNames: string[];
};

export type ExpoLiveStats = ExpoCatalogStats & {
  visitorsTotal: number | null;
  visitorsRegisteredToday: number | null;
  visitorsCheckedInToday: number | null;
  statsAsOf: string;
  mongoConnected: boolean;
};

export function computeCatalogStats(
  boothOverrides: Record<string, BoothLayoutPatch> = {},
): ExpoCatalogStats {
  const developers = buildExpoDeveloperCatalog(boothOverrides);
  return summarizeDevelopers(developers);
}

export function summarizeDevelopers(developers: ExpoDeveloper[]): ExpoCatalogStats {
  const residentialDeveloperCount = developers.filter((d) =>
    d.propertyTypes.includes('residential'),
  ).length;
  const commercialDeveloperCount = developers.filter((d) =>
    d.propertyTypes.includes('commercial'),
  ).length;
  const totalProjects = developers.reduce((n, d) => n + d.projects.length, 0);
  const newLaunchProjectCount = developers.reduce(
    (n, d) => n + d.projects.filter((p) => p.status === 'new_launch').length,
    0,
  );

  return {
    developerCount: developers.length,
    residentialDeveloperCount,
    commercialDeveloperCount,
    totalProjects,
    newLaunchProjectCount,
    developerNames: developers.map((d) => d.name),
  };
}

/** Plain-text facts block for LLM system prompts (Help Desk / expo concierge). */
export function buildExpoStatsFactsBlock(stats: ExpoLiveStats, propertyType?: PropertyTypeChoice | null): string {
  const lines = [
    `Expo live statistics (as of ${stats.statsAsOf}):`,
    `- Developers exhibiting: ${stats.developerCount} (${stats.developerNames.join(', ')})`,
    `- Residential developers: ${stats.residentialDeveloperCount}`,
    `- Commercial developers: ${stats.commercialDeveloperCount}`,
    `- Total listed projects in the expo catalog: ${stats.totalProjects}`,
    `- New-launch projects in catalog: ${stats.newLaunchProjectCount}`,
  ];

  if (stats.mongoConnected) {
    lines.push(
      `- Visitors registered today: ${stats.visitorsRegisteredToday ?? 0}`,
      `- Total visitors in registration database: ${stats.visitorsTotal ?? 0}`,
      `- Visitors checked in at lobby today: ${stats.visitorsCheckedInToday ?? 0}`,
    );
  } else {
    lines.push('- Visitor registration counts: unavailable (MongoDB not connected on dev server)');
  }

  if (propertyType) {
    lines.push(`- Visitor is browsing: ${propertyType} properties`);
  }

  lines.push(
    '',
    'Use ONLY these numbers for counts. "Developers" means exhibitor booths/brands, not software engineers.',
    '"Registered today" means visitors who completed registration today, not new PDF uploads.',
  );

  return lines.join('\n');
}

/** Fast local answers for common Help Desk count questions (no LLM). */
export function tryAnswerExpoStatsQuestion(
  question: string,
  stats: ExpoLiveStats,
): string | null {
  const q = question.toLowerCase().trim();
  if (!q) return null;

  if (
    /how many developer|number of developer|developers? (are )?(there|at)|count.*developer|total developer/.test(
      q,
    )
  ) {
    return `There are **${stats.developerCount}** developers exhibiting at this expo: ${stats.developerNames.join(', ')}. The catalog lists **${stats.totalProjects}** projects across all booths.`;
  }

  if (
    /how many project|number of project|projects? (are )?(there|listed)|total project/.test(q)
  ) {
    return `The expo catalog currently lists **${stats.totalProjects}** projects across **${stats.developerCount}** developers, including **${stats.newLaunchProjectCount}** marked as new launch.`;
  }

  if (
    /register(ed)? today|signed up today|visitors? today|registration(s)? today|how many (people|visitor)/.test(
      q,
    )
  ) {
    if (!stats.mongoConnected) {
      return 'Live visitor registration counts need **MongoDB** on the dev server (`MONGODB_URI` in `.env`). Developer and project counts are still available from the expo catalog.';
    }
    const today = stats.visitorsRegisteredToday ?? 0;
    const total = stats.visitorsTotal ?? 0;
    const checkIn = stats.visitorsCheckedInToday ?? 0;
    return `**${today}** visitor(s) registered today. **${checkIn}** checked in at the lobby today. **${total}** total registrations in the database.`;
  }

  if (/new launch|newly launched/.test(q)) {
    return `There are **${stats.newLaunchProjectCount}** new-launch projects in the current expo catalog.`;
  }

  return null;
}
