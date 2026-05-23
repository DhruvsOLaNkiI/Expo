export type CameraMode = 'head' | 'fullBody' | 'wideAngle';

export const CAMERA_MODE_ORDER: CameraMode[] = ['head', 'fullBody', 'wideAngle'];

export type CameraPreset = {
  label: string;
  shortLabel: string;
  /** First-person eye height above floor (m). */
  eyeHeight: number;
  /** Third-person distance behind the avatar (m). 0 = first person. */
  distance: number;
  /** Camera height above floor in third person (m). */
  heightOffset: number;
  fov: number;
  /** Show the GLB character model (only in third-person modes). */
  showAvatar: boolean;
};

export const CAMERA_MODES: Record<CameraMode, CameraPreset> = {
  head: {
    label: 'First person',
    shortLabel: 'Head',
    eyeHeight: 1.7,
    distance: 0,
    heightOffset: 0,
    fov: 65,
    showAvatar: false,
  },
  fullBody: {
    label: 'Third person',
    shortLabel: 'Body',
    eyeHeight: 0,
    distance: 3.5,
    heightOffset: 2.0,
    fov: 55,
    showAvatar: true,
  },
  wideAngle: {
    label: 'Wide angle',
    shortLabel: 'Wide',
    eyeHeight: 0,
    distance: 6.0,
    heightOffset: 2.8,
    fov: 85,
    showAvatar: true,
  },
};

export function nextCameraMode(current: CameraMode): CameraMode {
  const i = CAMERA_MODE_ORDER.indexOf(current);
  return CAMERA_MODE_ORDER[(i + 1) % CAMERA_MODE_ORDER.length];
}
