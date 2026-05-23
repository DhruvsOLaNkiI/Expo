import fs from 'node:fs';
import path from 'node:path';

const src = path.resolve(import.meta.dirname, '..', 'src');

function walk(dir, files = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, files);
    else if (/\.(tsx?)$/.test(ent.name)) files.push(p);
  }
  return files;
}

const replacements = [
  [/from ['"]\.\.\/store['"]/g, "from '@/store'"],
  [/from ['"]\.\.\/\.\.\/store['"]/g, "from '@/store'"],
  [/from ['"]\.\.\/data\//g, "from '@/features/shared/data/"],
  [/from ['"]\.\.\/\.\.\/data\//g, "from '@/features/shared/data/"],
  [/from ['"]\.\.\/hooks\//g, "from '@/hooks/"],
  [/from ['"]\.\.\/\.\.\/hooks\//g, "from '@/hooks/"],
  [/from ['"]\.\.\/utils\//g, "from '@/utils/"],
  [/from ['"]\.\.\/\.\.\/utils\//g, "from '@/utils/"],
  [/from ['"]\.\.\/camera\//g, "from '@/features/expo/camera/"],
  [/from ['"]\.\.\/api\//g, "from '@/api/"],
  [/from ['"]\.\.\/constants\//g, "from '@/constants/"],
  [/from ['"]\.\/api\//g, "from '@/api/"],
  [/from ['"]\.\/constants\//g, "from '@/constants/"],
  [/from ['"]\.\/store['"]/g, "from '@/store'"],
  [/from ['"]\.\/LedVideoPlane['"]/g, "from '@/features/media/components/LedVideoPlane'"],
  [/from ['"]\.\/LayoutEditableGroup['"]/g, "from '@/features/shared/LayoutEditableGroup'"],
  [/from ['"]\.\/RegistrationLobbyLighting['"]/g, "from '@/features/registration/components/RegistrationLobbyLighting'"],
];

for (const file of walk(path.join(src, 'features'))) {
  let text = fs.readFileSync(file, 'utf8');
  let changed = false;
  for (const [re, rep] of replacements) {
    if (re.test(text)) {
      text = text.replace(re, rep);
      changed = true;
    }
  }
  if (changed) fs.writeFileSync(file, text);
}

// store persist files
for (const file of walk(path.join(src, 'store'))) {
  let text = fs.readFileSync(file, 'utf8');
  text = text
    .replace(/from ['"]\.\.\/data\//g, "from '@/features/shared/data/")
    .replace(/from ['"]\.\.\/\.\.\/data\//g, "from '@/features/shared/data/")
    .replace(/from ['"]\.\.\/store['"]/g, "from '@/store'");
  fs.writeFileSync(file, text);
}

console.log('Fixed feature imports');
