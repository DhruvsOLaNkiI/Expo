import { useCallback } from 'react';
import { CmsUploadError, uploadCmsFile } from '@/api/cmsUpload';
import type { BoothLayoutConfig, BoothLayoutPatch } from '@/features/shared/data/boothLayouts';
import type { ExhibitorNavId } from './exhibitorConfig';
import {
  floorPlansFromConfig,
  siteMapUrlsFromConfig,
  unitLayoutsFromConfig,
} from '@/features/shared/data/boothLayouts';

export function exhibitorUploadError(e: unknown): string {
  return e instanceof CmsUploadError ? e.message : e instanceof Error ? e.message : 'Upload failed';
}

export async function exhibitorUploadFile(
  file: File,
  boothId: string,
  folder: string,
): Promise<string> {
  const up = await uploadCmsFile(file, boothId, folder);
  return up.url;
}

export type ExhibitorChecklistItem = {
  id: string;
  label: string;
  done: boolean;
  nav: ExhibitorNavId;
};

export function buildExhibitorChecklist(booth: BoothLayoutConfig): ExhibitorChecklistItem[] {
  const layouts = unitLayoutsFromConfig(booth);
  const layoutOk = layouts.some((u) => u.name.trim() && u.imageUrl.trim());
  const plans = floorPlansFromConfig(booth);
  const floorPlanOk = plans.some((u) => u.name.trim() && u.imageUrl.trim());
  const sales = booth.assignedSalesPerson;

  return [
    {
      id: 'logo',
      label: 'Booth logo',
      done: Boolean(booth.headerLogoUrl?.trim()),
      nav: 'setup',
    },
    {
      id: 'layouts',
      label: 'Unit layouts (name + image)',
      done: layoutOk,
      nav: 'setup',
    },
    {
      id: 'floorPlans',
      label: 'Floor plans (name + image)',
      done: floorPlanOk,
      nav: 'setup',
    },
    {
      id: 'site',
      label: 'Site layout',
      done: siteMapUrlsFromConfig(booth).length > 0,
      nav: 'setup',
    },
    {
      id: 'company',
      label: 'Exhibitor profile',
      done: Boolean(booth.company.companyName?.trim() && booth.company.email?.trim()),
      nav: 'setup',
    },
    {
      id: 'brochure',
      label: 'Project brochure',
      done: Boolean(booth.brochureUrl?.trim()),
      nav: 'uploads',
    },
    {
      id: 'price',
      label: 'Price list',
      done: Boolean(booth.priceListUrl?.trim()),
      nav: 'uploads',
    },
    {
      id: 'video',
      label: 'Walkthrough video',
      done: Boolean(booth.videoUrl?.trim()),
      nav: 'uploads',
    },
    {
      id: 'faq',
      label: 'FAQ document',
      done: Boolean(booth.faqUrl?.trim()) || (booth.customFaqQuestions?.length ?? 0) > 0,
      nav: 'faq',
    },
    {
      id: 'sales',
      label: 'Sales person assigned',
      done: Boolean(sales?.name?.trim()),
      nav: 'salesChat',
    },
  ];
}

export function exhibitorChecklistProgress(items: ExhibitorChecklistItem[]): {
  done: number;
  total: number;
  pct: number;
} {
  const done = items.filter((i) => i.done).length;
  const total = items.length;
  return { done, total, pct: total ? Math.round((done / total) * 100) : 0 };
}

export function useExhibitorPersist(patchBooth: (p: BoothLayoutPatch) => Promise<boolean>) {
  return useCallback(
    async (patch: BoothLayoutPatch, label: string): Promise<{ ok: boolean; message: string }> => {
      try {
        const ok = await patchBooth(patch);
        return {
          ok,
          message: ok
            ? `${label} saved for all visitors`
            : `${label} saved in this browser — connect MongoDB to share with visitors`,
        };
      } catch (e) {
        return { ok: false, message: exhibitorUploadError(e) };
      }
    },
    [patchBooth],
  );
}
