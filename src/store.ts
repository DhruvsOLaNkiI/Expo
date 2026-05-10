import { create } from 'zustand';

interface AppState {
  showInstructions: boolean;
  setShowInstructions: (show: boolean) => void;
  activeBooth: string | null;
  activeBoothPosition: [number, number, number] | null;
  setActiveBooth: (booth: string | null, position?: [number, number, number]) => void;
  playerPosition: [number, number, number] | null;
  setPlayerPosition: (pos: [number, number, number] | null) => void;
  joystickData: { x: number; y: number };
  setJoystickData: (data: { x: number; y: number }) => void;
}

export const useStore = create<AppState>((set) => ({
  showInstructions: true,
  setShowInstructions: (show) => set({ showInstructions: show }),
  activeBooth: null,
  activeBoothPosition: null,
  setActiveBooth: (booth, position) => set({ activeBooth: booth, activeBoothPosition: position || null }),
  playerPosition: null,
  setPlayerPosition: (pos) => set({ playerPosition: pos }),
  joystickData: { x: 0, y: 0 },
  setJoystickData: (data) => set({ joystickData: data }),
}));
