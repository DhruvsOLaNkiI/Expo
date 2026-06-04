import { MongoClient, Db, Collection } from 'mongodb';

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
    await boothsCollection.createIndex({ boothId: 1 }, { unique: true });

    const sceneCollection = db.collection('sceneSettings');
    await sceneCollection.createIndex({ configId: 1 }, { unique: true });

    console.log('Connected to MongoDB successfully');
    return db;
  } catch (error) {
    lastConnectFailAt = Date.now();
    lastConnectError = error instanceof Error ? error.message : 'MongoDB connect failed';
    console.error('Failed to connect to MongoDB:', lastConnectError);
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

export async function getPageIndexByBoothAndType(
  boothId: string,
  documentType: string
): Promise<PageIndexDocument | null> {
  try {
    const db = await connectToDatabase();
    const collection = db.collection<PageIndexDocument>('pageindexes');
    
    const doc = await collection.findOne(
      { boothId, documentType },
      { sort: { indexedAt: -1, updatedAt: -1 } },
    );
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
  boothId: string;
  /** Partial overrides — same shape as BoothLayoutPatch. Only R2 URLs, never base64. */
  patch: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export async function getAllBoothOverrides(): Promise<Record<string, Record<string, unknown>>> {
  try {
    const db = await connectToDatabase();
    const col = db.collection<BoothOverrideDocument>('booths');
    const docs = await col.find({}).toArray();
    const out: Record<string, Record<string, unknown>> = {};
    for (const d of docs) out[d.boothId] = d.patch;
    return out;
  } catch (error) {
    console.error('Error fetching booth overrides:', error);
    return {};
  }
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

export async function patchBoothOverride(
  boothId: string,
  patch: Record<string, unknown>,
): Promise<boolean> {
  try {
    const db = await connectToDatabase();
    const col = db.collection<BoothOverrideDocument>('booths');
    const now = new Date();
    const existing = await col.findOne({ boothId });
    const merged = { ...(existing?.patch ?? {}), ...patch };
    await col.updateOne(
      { boothId },
      { $set: { patch: merged, updatedAt: now }, $setOnInsert: { boothId, createdAt: now } },
      { upsert: true },
    );
    return true;
  } catch (error) {
    console.error(`Error patching booth ${boothId}:`, error);
    return false;
  }
}

export async function deleteBoothOverride(boothId: string): Promise<boolean> {
  try {
    const db = await connectToDatabase();
    const col = db.collection<BoothOverrideDocument>('booths');
    await col.deleteOne({ boothId });
    return true;
  } catch (error) {
    console.error(`Error deleting booth ${boothId}:`, error);
    return false;
  }
}

export async function saveAllBoothOverrides(
  overrides: Record<string, Record<string, unknown>>,
): Promise<boolean> {
  try {
    const db = await connectToDatabase();
    const col = db.collection<BoothOverrideDocument>('booths');
    const now = new Date();
    const ops = Object.entries(overrides).map(([boothId, patch]) => ({
      updateOne: {
        filter: { boothId },
        update: { $set: { patch, updatedAt: now }, $setOnInsert: { boothId, createdAt: now } },
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

// ─── Scene settings (single document per expo) ───

export interface SceneSettingsDocument {
  _id?: string;
  configId: string;
  settings: Record<string, unknown>;
  r2PublicBase?: string;
  createdAt: Date;
  updatedAt: Date;
}

export async function getSceneSettings(): Promise<{
  settings: Record<string, unknown>;
  r2PublicBase: string;
}> {
  try {
    const db = await connectToDatabase();
    const col = db.collection<SceneSettingsDocument>('sceneSettings');
    const doc = await col.findOne({ configId: 'default' });
    return {
      settings: doc?.settings ?? {},
      r2PublicBase: doc?.r2PublicBase ?? '',
    };
  } catch (error) {
    console.error('Error fetching scene settings:', error);
    return { settings: {}, r2PublicBase: '' };
  }
}

export async function patchSceneSettings(
  patch: Record<string, unknown>,
  r2PublicBase?: string,
): Promise<boolean> {
  try {
    const db = await connectToDatabase();
    const col = db.collection<SceneSettingsDocument>('sceneSettings');
    const now = new Date();
    const existing = await col.findOne({ configId: 'default' });
    const merged = { ...(existing?.settings ?? {}), ...patch };
    const $set: Record<string, unknown> = { settings: merged, updatedAt: now };
    if (r2PublicBase !== undefined) $set.r2PublicBase = r2PublicBase;
    await col.updateOne(
      { configId: 'default' },
      { $set, $setOnInsert: { configId: 'default', createdAt: now } },
      { upsert: true },
    );
    return true;
  } catch (error) {
    console.error('Error patching scene settings:', error);
    return false;
  }
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
export async function getFullExpoConfig(): Promise<{
  booths: Record<string, Record<string, unknown>>;
  scene: Record<string, unknown>;
  r2PublicBase: string;
}> {
  const [booths, { settings: scene, r2PublicBase }] = await Promise.all([
    getAllBoothOverrides(),
    getSceneSettings(),
  ]);
  return { booths, scene, r2PublicBase };
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
