import { MongoClient, Db, type Collection } from 'mongodb';
import {
  DEFAULT_EXPO_HALLS,
  DEFAULT_EXPO_HALL_ID,
  LEGACY_EXPO_HALL_ID,
  dedupeExpoHalls,
  normalizeHallId,
  type ExpoHallMeta,
} from '../features/shared/data/expoHalls';

let cachedDb: Db | null = null;
let cachedClient: MongoClient | null = null;

/** When a connect attempt failed, skip retries for this long so API calls fail fast instead of hanging. */
const CONNECT_RETRY_COOLDOWN_MS = 15_000; 
let lastConnectFailAt = 0;
let lastConnectError = '';

export type PageIndexDocType = 'brochure' | 'priceList' | 'siteLayout' | 'unitLayout';

export type PageIndexStatus = 'pending' | 'indexing' | 'ready' | 'failed';

export interface PageIndexDocument {
  _id?: string;
  boothId: string;
  documentType: PageIndexDocType;
  pdfUrl?: string;
  pdfHash?: string;
  structure?: unknown | null;
  pages?: Array<{ page: number; content: string }>;
  indexedAt?: Date | null;
  modelVersion?: string;
  indexStatus?: PageIndexStatus;
  indexError?: string;
  createdAt: Date;
  updatedAt: Date;
}

/** True when the tree has been built and is usable for AI chat. */
export function hasValidPageIndexStructure(structure: unknown): boolean {
  if (!structure) return false;
  if (Array.isArray(structure)) return structure.length > 0;
  if (typeof structure === 'object') {
    const inner = (structure as { structure?: unknown[] }).structure;
    if (Array.isArray(inner)) return inner.length > 0;
    return Object.keys(structure as object).length > 0;
  }
  return false;
}

/**
 * Record a failed index run (no structure written). Only called after indexing attempt fails.
 */
export async function markPageIndexFailed(
  boothId: string,
  documentType: PageIndexDocType,
  pdfUrl: string,
  errorMessage: string,
): Promise<void> {
  const db = await connectToDatabase();
  const collection = db.collection<PageIndexDocument>('pageindexes');
  const now = new Date();
  const indexError = errorMessage.trim().slice(0, 4000) || 'PageIndex failed';

  await collection.updateOne(
    { boothId, documentType },
    {
      $set: {
        pdfUrl,
        indexStatus: 'failed' as PageIndexStatus,
        indexError,
        updatedAt: now,
      },
      $setOnInsert: {
        boothId,
        documentType,
        pdfHash: '',
        structure: null,
        indexedAt: null,
        modelVersion: 'pending',
        createdAt: now,
      },
    },
    { upsert: true },
  );
}

/**
 * @deprecated Prefer: run PageIndex first, then savePageIndex / markPageIndexFailed only.
 * Legacy helper — avoid creating "indexing" rows before the tree exists.
 */
export async function ensurePageIndexSlot(
  boothId: string,
  documentType: PageIndexDocType,
  pdfUrl: string,
  status: PageIndexStatus = 'pending',
): Promise<void> {
  const db = await connectToDatabase();
  const collection = db.collection<PageIndexDocument>('pageindexes');
  const now = new Date();

  await collection.updateOne(
    { boothId, documentType },
    {
      $set: {
        pdfUrl,
        indexStatus: status,
        updatedAt: now,
        ...(status === 'failed' ? {} : { indexError: '' }),
      },
      $setOnInsert: {
        boothId,
        documentType,
        pdfHash: '',
        structure: null,
        indexedAt: null,
        modelVersion: 'pending',
        createdAt: now,
      },
    },
    { upsert: true },
  );
}

export interface UserProfile {
  _id?: string;
  email: string;
  name: string;
  phone?: string;
  boothId?: string;
  registeredAt: Date;
  visitedBooths?: string[];
}

/** Registration hall visitor (name + temporary ID from onboarding). */
export interface VisitorRegistration {
  _id?: string;
  visitorId: string;
  displayName: string;
  email?: string;
  phone?: string;
  avatar: {
    outfitColor: string;
    skinTone: string;
    hairColor: string;
  };
  createdAt: Date;
  /** Set when they complete desk check-in in the registration lobby. */
  lobbyCheckInAt?: Date;
  updatedAt: Date;
}

export async function connectToDatabase(): Promise<Db> {
  if (cachedDb && cachedClient) {
    return cachedDb;
  }

  const mongoUri = process.env.MONGODB_URI?.trim();
  if (!mongoUri) {
    throw new Error('MONGODB_URI environment variable is not set. Add it to .env file.');
  }

  // Fail fast if a recent attempt already failed (avoids 30s hangs on every API call
  // when the cluster is unreachable, e.g. DNS ENOTFOUND / paused Atlas cluster).
  const sinceFail = Date.now() - lastConnectFailAt;
  if (lastConnectFailAt && sinceFail < CONNECT_RETRY_COOLDOWN_MS) {
    throw new Error(lastConnectError || 'MongoDB unavailable (recent connect failed)');
  }

  try {
    const client = new MongoClient(mongoUri, {
      // Short timeouts so an unreachable cluster fails in seconds, not the 30s default.
      serverSelectionTimeoutMS: 5_000,
      connectTimeoutMS: 5_000,
    });
    await client.connect();
    lastConnectFailAt = 0;
    lastConnectError = '';

    const db = client.db('virtual-expo');
    
    cachedClient = client;
    cachedDb = db;

    // Create indexes for faster queries
    const pageIndexCollection = db.collection('pageindexes');
    await pageIndexCollection.createIndex({ boothId: 1, documentType: 1 });
    await pageIndexCollection.createIndex({ indexedAt: -1 });

    const usersCollection = db.collection('users');
    await usersCollection.createIndex({ email: 1 });

    const visitorsCollection = db.collection('visitors');
    await visitorsCollection.createIndex({ visitorId: 1 }, { unique: true });
    await visitorsCollection.createIndex({ createdAt: -1 });

    const boothsCollection = db.collection('booths');
    try {
      await ensureBoothCollectionIndexes(boothsCollection);
    } catch (e) {
      // Index repair must never block CMS saves — connection is still usable.
      console.warn('Booth index ensure failed (continuing with MongoDB):', e);
    }

    const sceneCollection = db.collection('sceneSettings');
    await sceneCollection.createIndex({ configId: 1 }, { unique: true });

    const expoHallsCollection = db.collection('expoHalls');
    await expoHallsCollection.createIndex({ hallId: 1 }, { unique: true });

    console.log('Connected to MongoDB successfully');
    return db;
  } catch (error) {
    lastConnectFailAt = Date.now();
    lastConnectError = error instanceof Error ? error.message : 'MongoDB connect failed';
    console.error('Failed to connect to MongoDB:', lastConnectError);
    throw error;
  }
}

/** All PageIndex rows in MongoDB (for CMS overview tab). */
export async function listAllPageIndexes(): Promise<PageIndexDocument[]> {
  try {
    const db = await connectToDatabase();
    const collection = db.collection<PageIndexDocument>('pageindexes');
    return collection.find({}).sort({ boothId: 1, documentType: 1 }).toArray();
  } catch (error) {
    console.error('Error listing all PageIndex documents:', error);
    throw error;
  }
}

export async function getPageIndexes(boothId: string): Promise<PageIndexDocument[]> {
  try {
    const db = await connectToDatabase();
    const collection = db.collection<PageIndexDocument>('pageindexes');
    
    const indexes = await collection
      .find({ boothId })
      .sort({ indexedAt: -1 })
      .toArray();
    
    return indexes;
  } catch (error) {
    console.error(`Error fetching PageIndex documents for booth ${boothId}:`, error);
    throw error;
  }
}

export async function savePageIndex(doc: PageIndexDocument): Promise<string> {
  if (!hasValidPageIndexStructure(doc.structure)) {
    throw new Error('PageIndex tree is empty or invalid — not saving to MongoDB');
  }

  try {
    const db = await connectToDatabase();
    const collection = db.collection<PageIndexDocument>('pageindexes');
    const now = new Date();

    const result = await collection.findOneAndUpdate(
      { boothId: doc.boothId, documentType: doc.documentType },
      {
        $set: {
          pdfUrl: doc.pdfUrl,
          pdfHash: doc.pdfHash ?? '',
          structure: doc.structure,
          pages: doc.pages,
          indexedAt: doc.indexedAt ?? now,
          modelVersion: doc.modelVersion,
          indexStatus: 'ready' as PageIndexStatus,
          indexError: '',
          updatedAt: now,
        },
        $setOnInsert: {
          boothId: doc.boothId,
          documentType: doc.documentType,
          createdAt: now,
        },
      },
      { upsert: true, returnDocument: 'after' },
    );

    return result?._id?.toString() ?? '';
  } catch (error) {
    console.error('Error saving PageIndex document:', error);
    throw error;
  }
}

export async function updatePageIndex(boothId: string, documentType: string, doc: Partial<PageIndexDocument>): Promise<void> {
  try {
    const db = await connectToDatabase();
    const collection = db.collection<PageIndexDocument>('pageindexes');
    
    await collection.updateOne(
      { boothId, documentType },
      {
        $set: {
          ...doc,
          updatedAt: new Date(),
        },
      },
      { upsert: true }
    );
  } catch (error) {
    console.error('Error updating PageIndex document:', error);
    throw error;
  }
}

/** Raw Mongo row for CMS tree inspector (includes failed / pending docs). */
export async function getPageIndexDocumentRaw(
  boothId: string,
  documentType: string,
): Promise<PageIndexDocument | null> {
  try {
    const db = await connectToDatabase();
    const collection = db.collection<PageIndexDocument>('pageindexes');
    return collection.findOne(
      { boothId, documentType },
      { sort: { indexedAt: -1, updatedAt: -1 } },
    );
  } catch (error) {
    console.error(`Error fetching raw PageIndex for ${boothId}/${documentType}:`, error);
    throw error;
  }
}

export async function getPageIndexByBoothAndType(
  boothId: string,
  documentType: string
): Promise<PageIndexDocument | null> {
  try {
    const doc = await getPageIndexDocumentRaw(boothId, documentType);
    if (!doc) return null;
    if (doc.indexStatus === 'ready' || hasValidPageIndexStructure(doc.structure)) return doc;
    return null;
  } catch (error) {
    console.error(`Error fetching PageIndex for ${boothId}/${documentType}:`, error);
    throw error;
  }
}

export async function saveUserProfile(user: UserProfile): Promise<string> {
  try {
    const db = await connectToDatabase();
    const collection = db.collection<UserProfile>('users');
    
    // Check if user exists
    const existing = await collection.findOne({ email: user.email });
    
    if (existing) {
      await collection.updateOne(
        { email: user.email },
        {
          $set: {
            ...user,
            updatedAt: new Date(),
          },
          $addToSet: { visitedBooths: user.boothId },
        }
      );
      return existing._id!.toString();
    }
    
    const result = await collection.insertOne({
      ...user,
      registeredAt: new Date(),
      visitedBooths: user.boothId ? [user.boothId] : [],
    });
    
    return result.insertedId.toString();
  } catch (error) {
    console.error('Error saving user profile:', error);
    throw error;
  }
}

export async function getUserProfile(email: string): Promise<UserProfile | null> {
  try {
    const db = await connectToDatabase();
    const collection = db.collection<UserProfile>('users');
    
    const user = await collection.findOne({ email });
    return user || null;
  } catch (error) {
    console.error(`Error fetching user profile for ${email}:`, error);
    throw error;
  }
}

export async function saveVisitorRegistration(
  visitor: Omit<VisitorRegistration, '_id' | 'updatedAt'> & { lobbyCheckInAt?: Date },
): Promise<string> {
  const db = await connectToDatabase();
  const collection = db.collection<VisitorRegistration>('visitors');
  const now = new Date();

  const existing = await collection.findOne({ visitorId: visitor.visitorId });
  if (existing) {
    await collection.updateOne(
      { visitorId: visitor.visitorId },
      {
        $set: {
          displayName: visitor.displayName,
          email: visitor.email,
          phone: visitor.phone,
          avatar: visitor.avatar,
          createdAt: visitor.createdAt,
          ...(visitor.lobbyCheckInAt ? { lobbyCheckInAt: visitor.lobbyCheckInAt } : {}),
          updatedAt: now,
        },
      },
    );
    return existing._id!.toString();
  }

  const result = await collection.insertOne({
    visitorId: visitor.visitorId,
    displayName: visitor.displayName,
    email: visitor.email,
    phone: visitor.phone,
    avatar: visitor.avatar,
    createdAt: visitor.createdAt,
    lobbyCheckInAt: visitor.lobbyCheckInAt,
    updatedAt: now,
  });
  return result.insertedId.toString();
}

export async function getVisitorById(visitorId: string): Promise<VisitorRegistration | null> {
  const db = await connectToDatabase();
  const collection = db.collection<VisitorRegistration>('visitors');
  return collection.findOne({ visitorId });
}

export async function markVisitorLobbyCheckIn(visitorId: string): Promise<void> {
  const db = await connectToDatabase();
  const collection = db.collection<VisitorRegistration>('visitors');
  await collection.updateOne(
    { visitorId },
    { $set: { lobbyCheckInAt: new Date(), updatedAt: new Date() } },
  );
}

export type VisitorRegistrationStats = {
  visitorsTotal: number;
  visitorsRegisteredToday: number;
  visitorsCheckedInToday: number;
};

/** Counts for Help Desk / expo concierge AI (start of local calendar day, server timezone). */
export async function getVisitorRegistrationStats(): Promise<VisitorRegistrationStats> {
  const db = await connectToDatabase();
  const collection = db.collection<VisitorRegistration>('visitors');
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const [visitorsTotal, visitorsRegisteredToday, visitorsCheckedInToday] = await Promise.all([
    collection.countDocuments({}),
    collection.countDocuments({ createdAt: { $gte: startOfDay } }),
    collection.countDocuments({ lobbyCheckInAt: { $gte: startOfDay } }),
  ]);

  return { visitorsTotal, visitorsRegisteredToday, visitorsCheckedInToday };
}

// ─── Booth overrides (CMS config, R2 URLs, layouts — NO binary data) ───

export interface BoothOverrideDocument {
  _id?: string;
  /** @deprecated Legacy — use hallId + slotId. Kept for old rows. */
  boothId?: string;
  hallId?: string;
  slotId?: string;
  /** Partial overrides — same shape as BoothLayoutPatch. Only R2 URLs, never base64. */
  patch: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

function docHallAndSlot(d: BoothOverrideDocument): { hallId: string; slotId: string } {
  if (d.hallId && d.slotId) return { hallId: d.hallId, slotId: d.slotId };
  const legacySlot = d.boothId?.trim() || d.slotId?.trim() || '';
  return { hallId: LEGACY_EXPO_HALL_ID, slotId: legacySlot };
}

const BOOTH_LAYOUT_PATCH_KEYS = ['position', 'rotation', 'scale', 'displayLayout'] as const;

/** One booth per hall — global unique boothId blocked hall-2..6 writes. */
async function ensureBoothCollectionIndexes(col: Collection<BoothOverrideDocument>): Promise<void> {
  // Legacy rows may miss slotId, or two rows may claim the same hall + slot. Either case makes
  // the unique index fail to build (E11000), which breaks every CMS save. Normalise then dedupe.
  try {
    const all = await col.find({}).toArray();
    const byKey = new Map<string, BoothOverrideDocument[]>();

    for (const doc of all) {
      const slot = (doc.slotId ?? '').trim() || (doc.boothId ?? '').trim();
      if (!slot) {
        await col.deleteOne({ _id: doc._id });
        console.warn(`Removed orphan booths doc without slotId/boothId: ${String(doc._id)}`);
        continue;
      }
      const hall = doc.hallId?.trim() || LEGACY_EXPO_HALL_ID;
      const key = `${hall}::${slot}`;
      byKey.set(key, [...(byKey.get(key) ?? []), { ...doc, hallId: hall, slotId: slot }]);
    }

    for (const [key, docs] of byKey) {
      // Newest wins, older patches fill gaps — never silently drop an exhibitor's data.
      const ordered = [...docs].sort(
        (a, b) => (b.updatedAt?.getTime?.() ?? 0) - (a.updatedAt?.getTime?.() ?? 0),
      );
      const [keep, ...extras] = ordered;
      const mergedPatch = ordered
        .slice()
        .reverse()
        .reduce<Record<string, unknown>>((acc, d) => ({ ...acc, ...(d.patch ?? {}) }), {});

      await col.updateOne(
        { _id: keep._id },
        {
          $set: {
            patch: mergedPatch,
            hallId: keep.hallId,
            slotId: keep.slotId,
            boothId: keep.slotId,
            updatedAt: keep.updatedAt ?? new Date(),
          },
        },
      );

      if (extras.length) {
        await col.deleteMany({ _id: { $in: extras.map((d) => d._id) } });
        console.log(`Merged ${extras.length} duplicate booths doc(s) for ${key}`);
      }
    }
  } catch (e) {
    console.warn('Could not normalise booths collection:', e);
  }

  try {
    const indexes = await col.indexes();
    for (const idx of indexes) {
      if (idx.key?.boothId === 1 && idx.unique && idx.name) {
        await col.dropIndex(idx.name);
        console.log(`Dropped legacy booths index: ${idx.name}`);
      }
      // Replace old sparse unique — it treated multiple null slotIds as duplicates.
      if (idx.name === 'hallId_1_slotId_1' && !idx.partialFilterExpression) {
        await col.dropIndex(idx.name);
        console.log(`Dropped sparse booths index: ${idx.name}`);
      }
    }
  } catch (e) {
    console.warn('Could not drop legacy boothId index:', e);
  }

  try {
    await col.createIndex(
      { hallId: 1, slotId: 1 },
      {
        unique: true,
        name: 'hallId_1_slotId_1',
        partialFilterExpression: {
          hallId: { $type: 'string' },
          slotId: { $type: 'string' },
        },
      },
    );
  } catch (e) {
    console.warn('Could not create hallId+slotId index (saves may still work):', e);
  }

  try {
    await col.createIndex({ boothId: 1 }, { sparse: true });
  } catch (e) {
    console.warn('Could not create boothId index:', e);
  }
}

function pickLayoutPatch(patch: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of BOOTH_LAYOUT_PATCH_KEYS) {
    if (patch[k] != null) out[k] = patch[k];
  }
  return out;
}

/**
 * Copy position / rotation / scale / displayLayout for one slot from source hall → target hall.
 * Merges into existing target patch (branding unchanged).
 */
export async function copyBoothLayoutToHall(
  sourceHallId: string,
  targetHallId: string,
  slotId: string,
): Promise<{ ok: boolean; error?: string }> {
  const source = normalizeHallId(sourceHallId);
  const target = normalizeHallId(targetHallId);
  const slot = slotId.trim();
  if (!slot) return { ok: false, error: 'Missing slotId' };
  if (source === target) return { ok: false, error: 'Source and target hall must differ' };

  try {
    const byHall = await getBoothOverridesForHall(source);
    const sourcePatch = byHall[slot];
    if (!sourcePatch) {
      return { ok: false, error: `No booth "${slot}" on ${source}` };
    }
    const layoutOnly = pickLayoutPatch(sourcePatch);
    if (Object.keys(layoutOnly).length === 0) {
      return { ok: false, error: `No layout fields on ${source}/${slot}` };
    }
    const ok = await patchBoothOverrideForHall(target, slot, layoutOnly);
    if (!ok) return { ok: false, error: 'MongoDB write failed' };
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Copy failed';
    return { ok: false, error: msg };
  }
}

function sceneConfigId(hallId: string): string {
  const h = normalizeHallId(hallId);
  return h === LEGACY_EXPO_HALL_ID ? 'default' : h;
}

// ─── Expo halls registry ───

export interface ExpoHallDocument {
  _id?: string;
  hallId: string;
  label: string;
  sortOrder: number;
  enabled: boolean;
  spawn: [number, number, number];
  createdAt: Date;
  updatedAt: Date;
}

export async function ensureExpoHallsSeeded(): Promise<ExpoHallMeta[]> {
  try {
    const db = await connectToDatabase();
    const col = db.collection<ExpoHallDocument>('expoHalls');
    const now = new Date();
    // Idempotent upsert — safe when init + cms-overview run in parallel (no double insertMany).
    await Promise.all(
      DEFAULT_EXPO_HALLS.map((h) =>
        col.updateOne(
          { hallId: h.hallId },
          {
            $set: {
              label: h.label,
              sortOrder: h.sortOrder,
              enabled: h.enabled,
              spawn: h.spawn,
              updatedAt: now,
            },
            $setOnInsert: { hallId: h.hallId, createdAt: now },
          },
          { upsert: true },
        ),
      ),
    );

    const docs = await col.find({ enabled: { $ne: false } }).sort({ sortOrder: 1 }).toArray();
    const halls = dedupeExpoHalls(
      docs.map((d) => ({
        hallId: d.hallId,
        label: d.label,
        sortOrder: d.sortOrder,
        enabled: d.enabled !== false,
        spawn: d.spawn as [number, number, number],
      })),
    );

    // Remove duplicate Mongo rows (same hallId) left from earlier race inserts.
    const seen = new Set<string>();
    for (const d of docs) {
      if (!d.hallId || seen.has(d.hallId)) {
        if (d._id) await col.deleteOne({ _id: d._id });
        continue;
      }
      seen.add(d.hallId);
    }

    if (halls.length === 0) return [...DEFAULT_EXPO_HALLS];
    return halls;
  } catch (error) {
    console.error('Error ensuring expo halls:', error);
    return [...DEFAULT_EXPO_HALLS];
  }
}

export async function listExpoHalls(): Promise<ExpoHallMeta[]> {
  return ensureExpoHallsSeeded();
}

export async function getBoothOverridesForHall(
  hallId: string,
): Promise<Record<string, Record<string, unknown>>> {
  try {
    const db = await connectToDatabase();
    const col = db.collection<BoothOverrideDocument>('booths');
    const h = normalizeHallId(hallId);
    const docs = await col
      .find({
        $or: [
          { hallId: h },
          ...(h === LEGACY_EXPO_HALL_ID ? [{ hallId: { $exists: false } }, { hallId: null }] : []),
        ],
      })
      .toArray();
    const out: Record<string, Record<string, unknown>> = {};
    for (const d of docs) {
      const { hallId: docHall, slotId } = docHallAndSlot(d);
      if (docHall !== h || !slotId) continue;
      out[slotId] = d.patch;
    }
    return out;
  } catch (error) {
    console.error(`Error fetching booth overrides for ${hallId}:`, error);
    return {};
  }
}

export async function getAllBoothOverrides(): Promise<Record<string, Record<string, unknown>>> {
  return getBoothOverridesForHall(DEFAULT_EXPO_HALL_ID);
}

export async function getBoothOverride(boothId: string): Promise<Record<string, unknown> | null> {
  try {
    const db = await connectToDatabase();
    const col = db.collection<BoothOverrideDocument>('booths');
    const doc = await col.findOne({ boothId });
    return doc?.patch ?? null;
  } catch (error) {
    console.error(`Error fetching booth ${boothId}:`, error);
    return null;
  }
}

export async function patchBoothOverrideForHall(
  hallId: string,
  slotId: string,
  patch: Record<string, unknown>,
): Promise<boolean> {
  try {
    const db = await connectToDatabase();
    const col = db.collection<BoothOverrideDocument>('booths');
    const h = normalizeHallId(hallId);
    const slot = slotId.trim();
    if (!slot) return false;
    const now = new Date();
    const existing = await col.findOne({
      $or: [
        { hallId: h, slotId: slot },
        ...(h === LEGACY_EXPO_HALL_ID ? [{ boothId: slot, hallId: { $exists: false } }] : []),
      ],
    });
    const merged = { ...(existing?.patch ?? {}), ...patch };
    await col.updateOne(
      { hallId: h, slotId: slot },
      {
        $set: {
          patch: merged,
          updatedAt: now,
          hallId: h,
          slotId: slot,
          boothId: slot,
        },
        $setOnInsert: { createdAt: now },
      },
      { upsert: true },
    );
    if (h === LEGACY_EXPO_HALL_ID && existing?.boothId && !existing.hallId) {
      await col.deleteOne({ boothId: slot, hallId: { $exists: false } });
    }
    return true;
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error(`Error patching booth ${hallId}/${slotId}:`, msg);
    return false;
  }
}

export async function patchBoothOverride(
  boothId: string,
  patch: Record<string, unknown>,
  hallId: string = DEFAULT_EXPO_HALL_ID,
): Promise<boolean> {
  return patchBoothOverrideForHall(hallId, boothId, patch);
}

export async function deleteBoothOverrideForHall(hallId: string, slotId: string): Promise<boolean> {
  try {
    const db = await connectToDatabase();
    const col = db.collection<BoothOverrideDocument>('booths');
    const h = normalizeHallId(hallId);
    const slot = slotId.trim();
    await col.deleteOne({ hallId: h, slotId: slot });
    if (h === LEGACY_EXPO_HALL_ID) {
      await col.deleteOne({ boothId: slot, hallId: { $exists: false } });
    }
    return true;
  } catch (error) {
    console.error(`Error deleting booth ${hallId}/${slotId}:`, error);
    return false;
  }
}

export async function deleteBoothOverride(boothId: string, hallId: string = DEFAULT_EXPO_HALL_ID): Promise<boolean> {
  return deleteBoothOverrideForHall(hallId, boothId);
}

export async function saveAllBoothOverridesForHall(
  hallId: string,
  overrides: Record<string, Record<string, unknown>>,
): Promise<boolean> {
  try {
    const db = await connectToDatabase();
    const col = db.collection<BoothOverrideDocument>('booths');
    const h = normalizeHallId(hallId);
    const now = new Date();
    const ops = Object.entries(overrides).map(([slotId, patch]) => ({
      updateOne: {
        filter: { hallId: h, slotId },
        update: {
          $set: {
            patch,
            updatedAt: now,
            hallId: h,
            slotId,
            boothId: slotId,
          },
          $setOnInsert: { createdAt: now },
        },
        upsert: true,
      },
    }));
    if (ops.length > 0) await col.bulkWrite(ops);
    return true;
  } catch (error) {
    console.error('Error saving all booth overrides:', error);
    return false;
  }
}

export async function saveAllBoothOverrides(
  overrides: Record<string, Record<string, unknown>>,
  hallId: string = DEFAULT_EXPO_HALL_ID,
): Promise<boolean> {
  return saveAllBoothOverridesForHall(hallId, overrides);
}

// ─── Scene settings (single document per expo) ───

export interface SceneSettingsDocument {
  _id?: string;
  configId: string;
  settings: Record<string, unknown>;
  r2PublicBase?: string;
  createdAt: Date;
  updatedAt: Date;
}

export async function getSceneSettingsForHall(hallId: string): Promise<{
  settings: Record<string, unknown>;
  r2PublicBase: string;
}> {
  try {
    const db = await connectToDatabase();
    const col = db.collection<SceneSettingsDocument>('sceneSettings');
    const configId = sceneConfigId(hallId);
    const doc = await col.findOne({ configId });
    return {
      settings: doc?.settings ?? {},
      r2PublicBase: doc?.r2PublicBase ?? '',
    };
  } catch (error) {
    console.error('Error fetching scene settings:', error);
    return { settings: {}, r2PublicBase: '' };
  }
}

export async function getSceneSettings(): Promise<{
  settings: Record<string, unknown>;
  r2PublicBase: string;
}> {
  return getSceneSettingsForHall(DEFAULT_EXPO_HALL_ID);
}

export async function patchSceneSettingsForHall(
  hallId: string,
  patch: Record<string, unknown>,
  r2PublicBase?: string,
): Promise<boolean> {
  try {
    const db = await connectToDatabase();
    const col = db.collection<SceneSettingsDocument>('sceneSettings');
    const configId = sceneConfigId(hallId);
    const now = new Date();
    const existing = await col.findOne({ configId });
    const merged = { ...(existing?.settings ?? {}), ...patch };
    const $set: Record<string, unknown> = { settings: merged, updatedAt: now };
    if (r2PublicBase !== undefined) $set.r2PublicBase = r2PublicBase;
    await col.updateOne(
      { configId },
      { $set, $setOnInsert: { configId, createdAt: now } },
      { upsert: true },
    );
    return true;
  } catch (error) {
    console.error('Error patching scene settings:', error);
    return false;
  }
}

export async function patchSceneSettings(
  patch: Record<string, unknown>,
  r2PublicBase?: string,
  hallId: string = DEFAULT_EXPO_HALL_ID,
): Promise<boolean> {
  return patchSceneSettingsForHall(hallId, patch, r2PublicBase);
}

export async function resetSceneSettings(): Promise<boolean> {
  try {
    const db = await connectToDatabase();
    const col = db.collection<SceneSettingsDocument>('sceneSettings');
    await col.deleteOne({ configId: 'default' });
    return true;
  } catch (error) {
    console.error('Error resetting scene settings:', error);
    return false;
  }
}

/** Full expo config payload for GET /api/expo/config. */
export async function getFullExpoConfig(hallId: string = DEFAULT_EXPO_HALL_ID): Promise<{
  hallId: string;
  booths: Record<string, Record<string, unknown>>;
  scene: Record<string, unknown>;
  r2PublicBase: string;
}> {
  const h = normalizeHallId(hallId);
  const [booths, { settings: scene, r2PublicBase }] = await Promise.all([
    getBoothOverridesForHall(h),
    getSceneSettingsForHall(h),
  ]);
  return { hallId: h, booths, scene, r2PublicBase };
}

/** CMS: all halls with booth + scene overrides in one request. */
export async function getCmsExpoOverview(): Promise<{
  halls: ExpoHallMeta[];
  r2PublicBase: string;
  byHall: Record<
    string,
    { booths: Record<string, Record<string, unknown>>; scene: Record<string, unknown> }
  >;
}> {
  const halls = await listExpoHalls();
  const byHall: Record<
    string,
    { booths: Record<string, Record<string, unknown>>; scene: Record<string, unknown> }
  > = {};
  let r2PublicBase = '';
  await Promise.all(
    halls.map(async (hall) => {
      const cfg = await getFullExpoConfig(hall.hallId);
      if (cfg.r2PublicBase) r2PublicBase = cfg.r2PublicBase;
      byHall[hall.hallId] = { booths: cfg.booths, scene: cfg.scene };
    }),
  );
  return { halls, r2PublicBase, byHall };
}

// ─── Buyer Questionnaire ──────────────────────────────────────────────────

export interface QuestionnaireDocument {
  _id?: string;
  visitorId?: string;
  visitorName?: string;
  visitorEmail?: string;
  answers: Record<number, string>;
  totalScore: number;
  category: 'hot' | 'warm' | 'cold';
  categoryLabel: string;
  submittedAt: string;
  createdAt: Date;
}

export async function saveQuestionnaireResult(data: Omit<QuestionnaireDocument, '_id' | 'createdAt'>): Promise<boolean> {
  try {
    const db = await connectToDatabase();
    const col = db.collection<QuestionnaireDocument>('buyerQuestionnaires');
    await col.insertOne({ ...data, createdAt: new Date() });
    return true;
  } catch (err) {
    console.error('Error saving questionnaire result:', err);
    return false;
  }
}

export async function closeDatabase(): Promise<void> {
  if (cachedClient) {
    await cachedClient.close();
    cachedClient = null;
    cachedDb = null;
    console.log('Disconnected from MongoDB');
  }
}
