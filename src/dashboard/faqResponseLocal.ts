import type { FaqSubmissionRow } from './api/client';

const LS_KEY = 'vr-expo-faq-submissions';

function readAll(): Record<string, FaqSubmissionRow[]> {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, FaqSubmissionRow[]>)
      : {};
  } catch {
    return {};
  }
}

function writeAll(data: Record<string, FaqSubmissionRow[]>): void {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(data));
  } catch {
    /* ignore quota */
  }
}

export function appendLocalFaqSubmission(row: FaqSubmissionRow): void {
  const all = readAll();
  const list = all[row.boothId] ?? [];
  all[row.boothId] = [row, ...list].slice(0, 200);
  writeAll(all);
}

export function readLocalFaqSubmissions(boothId: string): FaqSubmissionRow[] {
  return readAll()[boothId] ?? [];
}
