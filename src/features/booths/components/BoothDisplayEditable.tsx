import type { ReactNode } from 'react';
import {
  mergeBoothDisplaySlot,
  type BoothDisplayLayout,
  type BoothDisplaySlot,
  type BoothDisplayTransform,
  boothDisplayObjectName,
} from '@/features/shared/data/boothDisplayLayout';
import { LayoutEditableGroup } from '@/features/shared/LayoutEditableGroup';

export function BoothDisplayEditable({
  boothId,
  slot,
  layout,
  defaults,
  children,
}: {
  boothId: string;
  slot: BoothDisplaySlot;
  layout?: BoothDisplayLayout;
  defaults: BoothDisplayTransform;
  children: ReactNode;
}) {
  const t = mergeBoothDisplaySlot(layout, slot, defaults);
  return (
    <LayoutEditableGroup
      name={boothDisplayObjectName(boothId, slot)}
      position={t.position}
      rotation={t.rotation}
      scale={t.scale}
    >
      {children}
    </LayoutEditableGroup>
  );
}
