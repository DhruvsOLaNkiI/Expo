import type { ReactNode } from 'react';
import { LayoutEditableGroup } from '@/features/shared/LayoutEditableGroup';

/** Editable booth root — registers in layout registry and keeps gizmo transforms while editing. */
export function BoothLayoutRoot({
  id,
  position,
  rotation,
  scale,
  children,
}: {
  id: string;
  position: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number, number];
  children: ReactNode;
}) {
  return (
    <LayoutEditableGroup
      name={`booth-root-${id}`}
      position={position}
      rotation={rotation}
      scale={scale}
    >
      {children}
    </LayoutEditableGroup>
  );
}
