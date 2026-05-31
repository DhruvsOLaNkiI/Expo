/**
 * One-time migration: reads public/booth-cms.json and seeds MongoDB
 * with booth overrides + scene settings.
 *
 * Usage:
 *   MONGODB_URI="mongodb://..." npx tsx scripts/migrate-booth-cms-to-mongo.ts
 */
import fs from 'node:fs';
import path from 'node:path';
import { MongoClient } from 'mongodb';

const CMS_PATH = path.resolve(__dirname, '..', 'public', 'booth-cms.json');

interface BoothCmsFile {
  r2PublicBase?: string;
  booths?: Record<string, Record<string, unknown>>;
  overrides?: Record<string, Record<string, unknown>>;
  scene?: Record<string, unknown>;
}

async function main() {
  const uri = process.env.MONGODB_URI?.trim();
  if (!uri) {
    console.error('Set MONGODB_URI environment variable');
    process.exit(1);
  }

  if (!fs.existsSync(CMS_PATH)) {
    console.log('No booth-cms.json found — nothing to migrate.');
    process.exit(0);
  }

  const raw = fs.readFileSync(CMS_PATH, 'utf8');
  const data: BoothCmsFile = JSON.parse(raw);
  const booths = data.booths ?? data.overrides ?? {};
  const scene = data.scene ?? {};
  const r2PublicBase = data.r2PublicBase ?? '';
  const boothIds = Object.keys(booths);

  console.log(`Found ${boothIds.length} booth(s), scene keys: ${Object.keys(scene).join(', ') || '(none)'}`);

  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db('virtual-expo');

  const boothsCol = db.collection('booths');
  const sceneCol = db.collection('sceneSettings');

  await boothsCol.createIndex({ boothId: 1 }, { unique: true });
  await sceneCol.createIndex({ configId: 1 }, { unique: true });

  const now = new Date();
  let upserted = 0;

  for (const [boothId, patch] of Object.entries(booths)) {
    if (!patch || typeof patch !== 'object') continue;
    await boothsCol.updateOne(
      { boothId },
      {
        $set: { patch, updatedAt: now },
        $setOnInsert: { boothId, createdAt: now },
      },
      { upsert: true },
    );
    upserted++;
  }

  if (Object.keys(scene).length > 0 || r2PublicBase) {
    await sceneCol.updateOne(
      { configId: 'default' },
      {
        $set: { settings: scene, r2PublicBase, updatedAt: now },
        $setOnInsert: { configId: 'default', createdAt: now },
      },
      { upsert: true },
    );
    console.log('Scene settings migrated.');
  }

  console.log(`Migrated ${upserted} booth(s) to MongoDB.`);

  await client.close();
  process.exit(0);
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
