import crypto from "crypto";
import fs from "fs/promises";
import { createReadStream } from "fs";
import path from "path";
import { minimatch } from "minimatch";
import { ScanDatabase } from "./database.mjs";

/**
 * @typedef {Object} FileSize
 * @property {number} raw - The size in bytes
 * @property {string} formatted - Human readable formatted size with units
 */

/**
 * @typedef {Object} FileInfo
 * @property {string} path - Full path to the file
 * @property {string} name - File name
 * @property {number} size - File size in bytes
 * @property {string} formattedSize - Human readable file size
 * @property {Date} created - File creation date
 * @property {Date} modified - File modification date
 * @property {string} quickHash - Partial file hash for quick comparison
 * @property {string|null} hash - Full file hash (calculated on demand)
 */

/**
 * Calculate SHA-256 hash of entire file
 * @param {string} filePath - Path to the file
 * @returns {Promise<string>} Hex string of file hash
 */
async function calculateHash(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash("sha256");
    const stream = createReadStream(filePath);

    stream.on("data", (data) => hash.update(data));
    stream.on("end", () => resolve(hash.digest("hex")));
    stream.on("error", (error) => reject(error));
  });
}

/**
 * Calculate quick hash of first 64KB of file
 * @param {string} filePath - Path to the file
 * @returns {Promise<string>} Hex string of partial file hash
 */
async function calculateQuickHash(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash("sha256");
    const stream = createReadStream(filePath, { start: 0, end: 65535 });

    stream.on("data", (data) => hash.update(data));
    stream.on("end", () => resolve(hash.digest("hex")));
    stream.on("error", (error) => reject(error));
  });
}

/**
 * Format file size to human readable format
 * @param {number} bytes - Size in bytes
 * @returns {FileSize} Object containing raw and formatted size
 */
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

/**
 * Scan directory for files
 * @param {string} dir - Directory path to scan
 * @param {boolean} recursive - Whether to scan subdirectories
 * @param {string[]} excludePatterns - Glob patterns to exclude
 * @param {function} progressCallback - Callback for progress updates
 * @param {ScanDatabase} db - Database instance
 * @param {number} scanId - Current scan ID
 * @returns {Promise<FileInfo[]>} Array of file information objects
 */
async function scanDirectory(
  dir,
  recursive,
  excludePatterns = [],
  progressCallback = () => {},
  db,
  scanId
) {
  try {
    const files = await fs.readdir(dir, { withFileTypes: true });
    let allFiles = [];
    let filesScanned = 0;

    for (const file of files) {
      const fullPath = path.join(dir, file.name);
      const relativePath = path.relative(process.cwd(), fullPath);

      // Check if path matches any exclude pattern
      if (excludePatterns.some((pattern) => minimatch(relativePath, pattern))) {
        continue;
      }

      try {
        if (file.isDirectory() && recursive) {
          const subDirFiles = await scanDirectory(
            fullPath,
            recursive,
            excludePatterns,
            progressCallback,
            db,
            scanId
          );
          allFiles = allFiles.concat(subDirFiles);
        } else if (file.isFile()) {
          const stats = await fs.stat(fullPath);
          const size = formatFileSize(stats.size);
          const quickHash = await calculateQuickHash(fullPath);

          const fileInfo = {
            path: fullPath,
            name: file.name,
            size: size.raw,
            formattedSize: size.formatted,
            created: stats.birthtime,
            modified: stats.mtime,
            quickHash,
            hash: null,
          };

          allFiles.push(fileInfo);
          filesScanned++;

          if (db) {
            db.addFile(scanId, fileInfo);
          }

          progressCallback(filesScanned);
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

/**
 * Find duplicate files in a directory
 * @param {string} dir - Directory path to scan
 * @param {Object} options - Scan options
 * @param {boolean} options.recursive - Whether to scan subdirectories
 * @param {string[]} options.exclude - Glob patterns to exclude
 * @param {string} options.indexPath - Path to store the index file
 * @param {boolean} options.incomplete - Whether to resume an incomplete scan
 * @param {function} options.onProgress - Progress callback
 * @returns {Promise<FileInfo[][]>} Array of file groups, where each group contains duplicate files
 */
export async function findDuplicates(dir, options = {}) {
  const {
    recursive = false,
    exclude = [],
    indexPath,
    incomplete = false,
    onProgress = () => {},
  } = options;

  const dbPath = indexPath || ScanDatabase.generateIndexPath(process.cwd());
  const db = new ScanDatabase(dbPath);
  const scanId = db.startScan(path.resolve(dir));

  try {
    const files = await scanDirectory(
      dir,
      recursive,
      exclude,
      (filesScanned) => {
        onProgress({ filesScanned, groupsFound: 0, phase: "scanning" });
        db.updateScanProgress(scanId, filesScanned, 0);
      },
      db,
      scanId
    );

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
    let groupsFound = 0;

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
            if (db) {
              const groupId = file.hash;
              const fileId = db.db
                .prepare("SELECT id FROM files WHERE path = ?")
                .get(file.path)?.id;
              if (fileId) {
                db.updateFileHash(fileId, file.hash, groupId);
              }
            }
          }

          // Group by full hash
          quickHashGroup.forEach((file) => {
            if (!duplicates.has(file.hash)) {
              duplicates.set(file.hash, []);
              groupsFound++;
            }
            duplicates.get(file.hash).push(file);
          });

          onProgress({
            filesScanned: files.length,
            groupsFound,
            phase: "hashing",
          });
          db.updateScanProgress(scanId, files.length, groupsFound);
        }
      }
    }

    // Filter out unique files and sort groups by size
    const result = Array.from(duplicates.values())
      .filter((group) => group.length > 1)
      .sort((a, b) => b[0].size - a[0].size);

    db.completeScan(scanId);
    return { result, dbPath, scanId };
  } catch (error) {
    throw new Error(`Failed to find duplicates: ${error.message}`);
  }
}
