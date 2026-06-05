/**
 * Option A: copy one booth's layout (position, rotation, scale) from a source hall to a target hall.
 *
 * Usage:
 *   MONGODB_URI="mongodb://..." npx tsx scripts/copy-booth-layout-to-hall.ts <slotId> <targetHall> [sourceHall]
 *
 * Examples:
 *   npx tsx scripts/copy-booth-layout-to-hall.ts builder-1 hall-2
 *   npx tsx scripts/copy-booth-layout-to-hall.ts vertex-elite hall-2 hall-1
 */
import 'dotenv/config';
import { MongoClient } from 'mongodb';
import { normalizeHallId, DEFAULT_EXPO_HALL_ID } from '../src/features/shared/data/expoHalls';

const LAYOUT_KEYS = ['position', 'rotation', 'scale', 'displayLayout'] as const;

async function main() {
  const uri = process.env.MONGODB_URI?.trim();
  if (!uri) {
    console.error('Set MONGODB_URI in .env');
    process.exit(1);
  }

  const slotId = process.argv[2]?.trim();
  const targetHall = normalizeHallId(process.argv[3]);
  const sourceHall = normalizeHallId(process.argv[4] ?? DEFAULT_EXPO_HALL_ID);

  if (!slotId || !process.argv[3]) {
    console.error(
      'Usage: npx tsx scripts/copy-booth-layout-to-hall.ts <slotId> <targetHall> [sourceHall]',
    );
    console.error('Example: npx tsx scripts/copy-booth-layout-to-hall.ts builder-1 hall-2 hall-1');
    process.exit(1);
  }

  if (sourceHall === targetHall) {
    console.error('Source and target hall must differ');
    process.exit(1);
  }

  const client = new MongoClient(uri);
  await client.connect();
  const col = client.db('virtual-expo').collection('booths');

  // Drop legacy unique boothId index if present (same as server startup).
  try {
    const indexes = await col.indexes();
    for (const idx of indexes) {
      if (idx.key?.boothId === 1 && idx.unique && idx.name) {
        await col.dropIndex(idx.name);
        console.log(`Dropped index ${idx.name}`);
      }
    }
  } catch {
    /* */
  }
  await col.createIndex({ hallId: 1, slotId: 1 }, { unique: true, sparse: true });

  const sourceDoc = await col.findOne({
    $or: [
      { hallId: sourceHall, slotId },
      ...(sourceHall === DEFAULT_EXPO_HALL_ID
        ? [{ boothId: slotId, hallId: { $exists: false } }]
        : []),
    ],
  });

  if (!sourceDoc?.patch || typeof sourceDoc.patch !== 'object') {
    console.error(`No booth "${slotId}" on ${sourceHall}. Check: db.booths.find({ hallId: "${sourceHall}" })`);
    await client.close();
    process.exit(1);
  }

  const patch = sourceDoc.patch as Record<string, unknown>;
  const layoutOnly: Record<string, unknown> = {};
  for (const k of LAYOUT_KEYS) {
    if (patch[k] != null) layoutOnly[k] = patch[k];
  }
  if (Object.keys(layoutOnly).length === 0) {
    console.error(`Booth ${sourceHall}/${slotId} has no position/rotation/scale in patch`);
    await client.close();
    process.exit(1);
  }

  const existing = await col.findOne({ hallId: targetHall, slotId });
  const merged = { ...(existing?.patch ?? {}), ...layoutOnly };
  const now = new Date();

  await col.updateOne(
    { hallId: targetHall, slotId },
    {
      $set: {
        hallId: targetHall,
        slotId,
        boothId: slotId,
        patch: merged,
        updatedAt: now,
      },
      $setOnInsert: { createdAt: now },
    },
    { upsert: true },
  );

  console.log(`Copied layout ${sourceHall}/${slotId} → ${targetHall}/${slotId}`);
  console.log('  position:', JSON.stringify(layoutOnly.position));
  console.log('  rotation:', JSON.stringify(layoutOnly.rotation));
  console.log('  scale:', JSON.stringify(layoutOnly.scale));

  await client.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
