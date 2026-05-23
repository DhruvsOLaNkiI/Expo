/**
 * AI capability modules — import from here for cross-feature AI wiring.
 * Implementation stays in components until each module is fully extracted.
 */
export { HelpDeskAiPanel } from '../components/HelpDeskAiPanel';
export { AiChatbox } from '../components/AiChatbox';
export {
  buildExpoDeveloperCatalog,
  filterDevelopersByMode,
  filterProjects,
  getAiSuggestion,
} from '@/features/shared/data/helpDeskCatalog';
export { buildExpoTeleportDestinations } from '@/features/shared/data/expoTeleportDestinations';
