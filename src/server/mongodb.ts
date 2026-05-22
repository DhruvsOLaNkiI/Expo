import { MongoClient, Db, Collection } from 'mongodb';

let cachedDb: Db | null = null;
let cachedClient: MongoClient | null = null;

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

async function connectToDatabase(): Promise<Db> {
  if (cachedDb && cachedClient) {
    return cachedDb;
  }

  const mongoUri = process.env.MONGODB_URI?.trim();
  if (!mongoUri) {
    throw new Error('MONGODB_URI environment variable is not set. Add it to .env file.');
  }

  try {
    const client = new MongoClient(mongoUri);
    await client.connect();
    
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

    console.log('Connected to MongoDB successfully');
    return db;
  } catch (error) {
    console.error('Failed to connect to MongoDB:', error);
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

export async function closeDatabase(): Promise<void> {
  if (cachedClient) {
    await cachedClient.close();
    cachedClient = null;
    cachedDb = null;
    console.log('Disconnected from MongoDB');
  }
}
