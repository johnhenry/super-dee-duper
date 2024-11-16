import crypto from "crypto";
import fs from "fs/promises";
import { createReadStream } from "fs";
import path from "path";

// Improved hash calculation using streams for better memory efficiency
async function calculateHash(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash("sha256");
    const stream = createReadStream(filePath);

    stream.on("data", (data) => hash.update(data));
    stream.on("end", () => resolve(hash.digest("hex")));
    stream.on("error", (error) => reject(error));
  });
}

// Quick hash calculation for initial comparison (first 64KB only)
async function calculateQuickHash(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash("sha256");
    const stream = createReadStream(filePath, { start: 0, end: 65535 });

    stream.on("data", (data) => hash.update(data));
    stream.on("end", () => resolve(hash.digest("hex")));
    stream.on("error", (error) => reject(error));
  });
}

// Format file size to human readable format
function formatFileSize(bytes) {
  const units = ["B", "KB", "MB", "GB", "TB"];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return {
    raw: bytes,
    formatted: `${size.toFixed(2)} ${units[unitIndex]}`,
  };
}

async function scanDirectory(dir, recursive) {
  try {
    const files = await fs.readdir(dir, { withFileTypes: true });
    let allFiles = [];

    for (const file of files) {
      const fullPath = path.join(dir, file.name);

      try {
        if (file.isDirectory() && recursive) {
          allFiles = allFiles.concat(await scanDirectory(fullPath, recursive));
        } else if (file.isFile()) {
          const stats = await fs.stat(fullPath);
          const size = formatFileSize(stats.size);

          allFiles.push({
            path: fullPath,
            name: file.name,
            size: size.raw,
            formattedSize: size.formatted,
            created: stats.birthtime,
            modified: stats.mtime,
            quickHash: await calculateQuickHash(fullPath),
            hash: null, // Full hash will be calculated only when needed
          });
        }
      } catch (error) {
        console.error(`Error processing ${fullPath}:`, error.message);
      }
    }

    return allFiles;
  } catch (error) {
    throw new Error(`Failed to scan directory ${dir}: ${error.message}`);
  }
}

export async function findDuplicates(dir, recursive) {
  try {
    const files = await scanDirectory(dir, recursive);

    // Group files by size first for quick filtering
    const sizeGroups = new Map();
    files.forEach((file) => {
      if (!sizeGroups.has(file.size)) {
        sizeGroups.set(file.size, []);
      }
      sizeGroups.get(file.size).push(file);
    });

    // Filter groups with more than one file
    const potentialDuplicates = Array.from(sizeGroups.values()).filter(
      (group) => group.length > 1
    );

    const duplicates = new Map();

    // For each size group, compare quick hashes
    for (const group of potentialDuplicates) {
      const quickHashGroups = new Map();

      // Group by quick hash
      group.forEach((file) => {
        if (!quickHashGroups.has(file.quickHash)) {
          quickHashGroups.set(file.quickHash, []);
        }
        quickHashGroups.get(file.quickHash).push(file);
      });

      // For files with matching quick hashes, calculate full hashes
      for (const quickHashGroup of quickHashGroups.values()) {
        if (quickHashGroup.length > 1) {
          // Calculate full hashes only for potential duplicates
          for (const file of quickHashGroup) {
            file.hash = await calculateHash(file.path);
          }

          // Group by full hash
          quickHashGroup.forEach((file) => {
            if (!duplicates.has(file.hash)) {
              duplicates.set(file.hash, []);
            }
            duplicates.get(file.hash).push(file);
          });
        }
      }
    }

    // Filter out unique files and sort groups by size
    return Array.from(duplicates.values())
      .filter((group) => group.length > 1)
      .sort((a, b) => b[0].size - a[0].size);
  } catch (error) {
    throw new Error(`Failed to find duplicates: ${error.message}`);
  }
}