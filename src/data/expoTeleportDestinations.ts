import {
  applyBoothOverrides,
  buildDefaultBoothLayoutList,
  defaultEntranceLobbyZ,
  type BoothLayoutPatch,
} from './boothLayouts';
import { REG_MAIN_EXPO_SPAWN, REG_SPAWN } from './registrationHall';

export type TeleportDestination = {
  id: string;
  label: string;
  position: [number, number, number];
};

const EYE_Y = 1.7;

/** Quick-travel points in the main 90×90 expo (booth positions respect CMS overrides). */
export function buildExpoTeleportDestinations(
  boothOverrides: Record<string, BoothLayoutPatch> = {},
): TeleportDestination[] {
  const layouts = applyBoothOverrides(buildDefaultBoothLayoutList(), boothOverrides);
  const entranceZ = defaultEntranceLobbyZ();

  const nearBooth = (id: string, label: string, dz = -5, dx = 3): TeleportDestination | null => {
    const b = layouts.find((x) => x.id === id);
    if (!b) return null;
    return {
      id,
      label,
      position: [b.position[0] + dx, EYE_Y, b.position[2] + dz],
    };
  };

  const fixed: TeleportDestination[] = [
    { id: 'main-entrance', label: 'Main entrance', position: [...REG_MAIN_EXPO_SPAWN] },
    { id: 'reception', label: 'Reception & LED', position: [0, EYE_Y, entranceZ - 4] },
    { id: 'center', label: 'Center plaza', position: [0, EYE_Y, 2] },
    { id: 'ballroom', label: 'Ballroom stage', position: [0, EYE_Y, -26] },
    { id: 'west-wing', label: 'West booths', position: [-16, EYE_Y, -8] },
    { id: 'east-wing', label: 'East booths', position: [16, EYE_Y, 8] },
  ];

  const boothStops = [
    nearBooth('vertex-elite', 'Vertex Elite', -6, 4),
    nearBooth('builder-2', 'Aurum Residences', -5, 4),
    nearBooth('builder-1', 'Luxe Towers', -5, 4),
    nearBooth('builder-5', 'The Monarch', -5, -4),
    nearBooth('builder-4', 'Crown Estates', -5, -4),
    nearBooth('builder-6', 'Horizon Vistas', -5, -4),
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
