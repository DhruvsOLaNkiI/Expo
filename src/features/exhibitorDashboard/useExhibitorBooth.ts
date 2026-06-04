import { useExhibitorBoothContext } from './ExhibitorBoothContext';

/** Current exhibitor booth (from sidebar switcher + ?booth= URL). */
export function useExhibitorBooth() {
  return useExhibitorBoothContext();
}
