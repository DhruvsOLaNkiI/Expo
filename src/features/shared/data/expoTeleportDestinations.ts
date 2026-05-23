import {
  applyBoothOverrides,
  BOOTH_ROW_X_EAST,
  BOOTH_ROW_X_WEST,
  EXPO_AISLE_EAST_X,
  EXPO_AISLE_WEST_X,
  buildDefaultBoothLayoutList,
  defaultEntranceLobbyZ,
  HALL_HALF_WIDTH,
  type BoothLayoutPatch,
  type HostessQuickReply,
} from './boothLayouts';
import { REG_MAIN_EXPO_SPAWN, REG_SPAWN } from './registrationHall';

export type TeleportDestination = {
  id: string;
  label: string;
  position: [number, number, number];
};

const EYE_Y = 1.7;

/** Quick-travel points in the main 65×30 expo (booth positions respect CMS overrides). */
export function buildExpoTeleportDestinations(
  boothOverrides: Record<string, BoothLayoutPatch> = {},
): TeleportDestination[] {
  const layouts = applyBoothOverrides(buildDefaultBoothLayoutList(), boothOverrides);
  const entranceZ = defaultEntranceLobbyZ();

  const nearBooth = (id: string, label: string, dz = -5): TeleportDestination | null => {
    const b = layouts.find((x) => x.id === id);
    if (!b) return null;
    const towardCenter = b.position[0] > 0 ? -5 : 5;
    return {
      id,
      label,
      position: [b.position[0] + towardCenter, EYE_Y, b.position[2] + dz],
    };
  };

  const fixed: TeleportDestination[] = [
    { id: 'main-entrance', label: 'Main entrance', position: [...REG_MAIN_EXPO_SPAWN] },
    { id: 'reception', label: 'Reception & LED', position: [0, EYE_Y, entranceZ - 4] },
    { id: 'center', label: 'Center plaza', position: [0, EYE_Y, 0] },
    { id: 'west-aisle', label: '← Left · West booths', position: [EXPO_AISLE_WEST_X, EYE_Y, 0] },
    { id: 'east-aisle', label: 'Right · East booths →', position: [EXPO_AISLE_EAST_X, EYE_Y, 0] },
    { id: 'both-rows', label: 'View both rows', position: [0, EYE_Y, -2] },
    { id: 'ballroom', label: 'Ballroom stage', position: [HALL_HALF_WIDTH - 7, EYE_Y, 0] },
    { id: 'west-wing', label: 'West row', position: [EXPO_AISLE_WEST_X, EYE_Y, -6] },
    { id: 'east-wing', label: 'East row', position: [EXPO_AISLE_EAST_X, EYE_Y, -6] },
  ];

  const boothStops = [
    nearBooth('vertex-elite', 'Vertex Elite', -6),
    nearBooth('builder-2', 'Aurum Residences', -5),
    nearBooth('builder-1', 'Luxe Towers', -5),
    nearBooth('builder-8', 'Luxe Gardens', -5),
    nearBooth('builder-9', 'Luxe Skyline', -5),
    nearBooth('builder-5', 'The Monarch', -5),
    nearBooth('builder-4', 'Crown Estates', -5),
    nearBooth('builder-6', 'Horizon Vistas', -5),
  ].filter((d): d is TeleportDestination => d != null);

  const seen = new Set<string>();
  return [...fixed, ...boothStops].filter((d) => {
    if (seen.has(d.id)) return false;
    seen.add(d.id);
    return true;
  });
}

export const REGISTRATION_LOBBY_DESTINATION: TeleportDestination = {
  id: 'registration-lobby',
  label: 'Registration lobby',
  position: [...REG_SPAWN],
};

/** Help-desk hostess — opens Smart AI Help Desk concierge. */
export function buildHelpDeskHostessReplies(): HostessQuickReply[] {
  return [
    {
      id: 'help-desk-smart',
      label: 'Open Smart Help Desk',
      response: '',
      action: 'helpDesk',
    },
    {
      id: 'help-desk-ai-chat',
      label: 'Ask AI Assistant',
      response: '',
      action: 'askAi',
    },
  ];
}
