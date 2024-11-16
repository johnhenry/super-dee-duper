import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';

async function calculateHash(filePath) {
  const content = await fs.readFile(filePath);
  return crypto.createHash('sha256').update(content).digest('hex');
}

async function scanDirectory(dir, recursive) {
  const files = await fs.readdir(dir, { withFileTypes: true });
  let allFiles = [];

  for (const file of files) {
    const fullPath = path.join(dir, file.name);
    
    if (file.isDirectory() && recursive) {
      allFiles = allFiles.concat(await scanDirectory(fullPath, recursive));
    } else if (file.isFile()) {
      const stats = await fs.stat(fullPath);
      allFiles.push({
        path: fullPath,
        size: stats.size,
        hash: await calculateHash(fullPath)
      });
    }
  }

  return allFiles;
}

export async function findDuplicates(dir, recursive) {
  const files = await scanDirectory(dir, recursive);
  const duplicates = new Map();

  files.forEach(file => {
    if (!duplicates.has(file.hash)) {
      duplicates.set(file.hash, []);
    }
    duplicates.set(file.hash, [...duplicates.get(file.hash), file]);
  });

  return Array.from(duplicates.values())
    .filter(group => group.length > 1);
}