import { useCallback } from 'react';
import { CmsUploadError, readFileAsDataUrl, uploadCmsFile } from '@/api/cmsUpload';
import { EXHIBITOR_SETUP_LOCAL_STORAGE } from './exhibitorConfig';
import {
  MAX_BOOTH_LOGO_SOURCE_BYTES,
  compressBoothLogoToDataUrl,
  compressSetupImageToDataUrl,
} from './exhibitorLogo';
import type { BoothLayoutConfig, BoothLayoutPatch } from '@/features/shared/data/boothLayouts';
import type { ExhibitorNavId } from './exhibitorConfig';
import {
  floorPlansFromConfig,
  siteMapUrlsFromConfig,
  unitLayoutsFromConfig,
} from '@/features/shared/data/boothLayouts';
import { useStore } from '@/store';
export function exhibitorUploadError(e: unknown): string {
  return e instanceof CmsUploadError ? e.message : e instanceof Error ? e.message : 'Upload failed';
}

/** Booth logo — compressed data URL stored in booth config (not R2). */
export async function exhibitorUploadBoothLogo(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new CmsUploadError('Logo must be a PNG, JPG, or WebP image.', 'upload_failed');
  }
  if (file.size > MAX_BOOTH_LOGO_SOURCE_BYTES) {
    throw new CmsUploadError('Logo source file must be under 15 MB.', 'upload_failed');
  }
  try {
    return await compressBoothLogoToDataUrl(file);
  } catch (e) {
    throw new CmsUploadError(
      e instanceof Error ? e.message : 'Could not process logo image',
      'upload_failed',
    );
  }
}

const SETUP_LOCAL_FOLDERS = new Set(['logo', 'unit-layout', 'floor-plan', 'site-map']);

function isSetupImage(file: File): boolean {
  return file.type.startsWith('image/') || /\.(png|jpe?g|webp|gif)$/i.test(file.name);
}

function isSetupPdf(file: File): boolean {
  return file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
}

/** Booth Setup assets — local data URLs only (no R2) while testing. */
export async function exhibitorUploadSetupFile(file: File): Promise<string> {
  if (isSetupImage(file)) {
    if (file.size > MAX_BOOTH_LOGO_SOURCE_BYTES) {
      throw new CmsUploadError('Image must be under 15 MB.', 'upload_failed');
    }
    try {
      return await compressSetupImageToDataUrl(file);
    } catch (e) {
      throw new CmsUploadError(
        e instanceof Error ? e.message : 'Could not process image',
        'upload_failed',
      );
    }
  }
  if (isSetupPdf(file)) {
    if (file.size > 4 * 1024 * 1024) {
      throw new CmsUploadError('PDF must be under 4 MB for local testing.', 'pdf_too_large');
    }
    return readFileAsDataUrl(file);
  }
  throw new CmsUploadError('Upload must be an image or PDF.', 'upload_failed');
}

/** Side-wall posters and counter front — larger compress than fascia logos. */
export async function exhibitorUploadPlacementImage(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new CmsUploadError('Image must be a PNG, JPG, or WebP file.', 'upload_failed');
  }
  if (file.size > MAX_BOOTH_LOGO_SOURCE_BYTES) {
    throw new CmsUploadError('Image must be under 15 MB.', 'upload_failed');
  }
  try {
    return await compressSetupImageToDataUrl(file);
  } catch (e) {
    throw new CmsUploadError(
      e instanceof Error ? e.message : 'Could not process image',
      'upload_failed',
    );
  }
}

export async function exhibitorUploadFile(
  file: File,
  boothId: string,
  folder: string,
): Promise<string> {
  if (folder === 'logo') {
    return exhibitorUploadBoothLogo(file);
  }

  if (EXHIBITOR_SETUP_LOCAL_STORAGE && SETUP_LOCAL_FOLDERS.has(folder)) {
    return exhibitorUploadSetupFile(file);
  }

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
      id: 'boothLayout',
      label: 'Booth layout (logos + project name)',
      done: Boolean(
        booth.headerLogoUrl?.trim() ||
          booth.wallLogoLeftUrl?.trim() ||
          booth.wallLogoRightUrl?.trim(),
      ),
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
      id: 'led',
      label: 'LED TV screen',
      done: Boolean(booth.stageScreenUrl?.trim()),
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
        if (!ok) {
          const detail =
            useStore.getState().lastBoothSaveError?.trim() ||
            'Server save failed — check admin login and that MongoDB is running.';
          return {
            ok: false,
            message: `${label} could not be saved. ${detail}`,
          };
        }
        return {
          ok: true,
          message: `${label} saved — switch to the expo tab to see it live (no full refresh needed).`,
        };
      } catch (e) {
        return { ok: false, message: exhibitorUploadError(e) };
      }
    },
    [patchBooth],
  );
}
