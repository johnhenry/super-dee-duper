import Database from "better-sqlite3";
import crypto from "crypto";
import path from "path";

export class ScanDatabase {
  constructor(dbPath) {
    this.db = new Database(dbPath);
    this.initializeDatabase();
  }

  initializeDatabase() {
    // Create tables if they don't exist
    this.db.exec(`
            CREATE TABLE IF NOT EXISTS scan_info (
                id INTEGER PRIMARY KEY,
                base_directory TEXT NOT NULL,
                start_time INTEGER NOT NULL,
                end_time INTEGER,
                files_scanned INTEGER DEFAULT 0,
                groups_found INTEGER DEFAULT 0
            );

            CREATE TABLE IF NOT EXISTS files (
                id INTEGER PRIMARY KEY,
                scan_id INTEGER,
                path TEXT NOT NULL,
                size INTEGER NOT NULL,
                created INTEGER NOT NULL,
                modified INTEGER NOT NULL,
                quick_hash TEXT NOT NULL,
                full_hash TEXT,
                group_id TEXT,
                FOREIGN KEY(scan_id) REFERENCES scan_info(id)
            );

            CREATE INDEX IF NOT EXISTS idx_files_group_id ON files(group_id);
            CREATE INDEX IF NOT EXISTS idx_files_scan_id ON files(scan_id);
        `);
  }

  startScan(baseDirectory) {
    const result = this.db
      .prepare(
        "INSERT INTO scan_info (base_directory, start_time) VALUES (?, ?)"
      )
      .run(baseDirectory, Date.now());
    return result.lastInsertRowid;
  }

  updateScanProgress(scanId, filesScanned, groupsFound) {
    this.db
      .prepare(
        "UPDATE scan_info SET files_scanned = ?, groups_found = ? WHERE id = ?"
      )
      .run(filesScanned, groupsFound, scanId);
  }

  completeScan(scanId) {
    this.db
      .prepare("UPDATE scan_info SET end_time = ? WHERE id = ?")
      .run(Date.now(), scanId);
  }

  addFile(scanId, fileInfo, groupId = null) {
    this.db
      .prepare(
        `
            INSERT INTO files (
                scan_id, path, size, created, modified, 
                quick_hash, full_hash, group_id
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `
      )
      .run(
        scanId,
        fileInfo.path,
        fileInfo.size,
        fileInfo.created.getTime(),
        fileInfo.modified.getTime(),
        fileInfo.quickHash,
        fileInfo.hash,
        groupId
      );
  }

  updateFileHash(fileId, fullHash, groupId) {
    this.db
      .prepare("UPDATE files SET full_hash = ?, group_id = ? WHERE id = ?")
      .run(fullHash, groupId, fileId);
  }

  getScanInfo(scanId) {
    return this.db.prepare("SELECT * FROM scan_info WHERE id = ?").get(scanId);
  }

  getDuplicateGroups(scanId) {
    return this.db
      .prepare(
        `
            SELECT 
                f.group_id,
                json_group_array(
                    json_object(
                        'path', f.path,
                        'size', f.size,
                        'created', f.created,
                        'modified', f.modified,
                        'quickHash', f.quick_hash,
                        'hash', f.full_hash
                    )
                ) as files
            FROM files f
            WHERE f.scan_id = ? AND f.group_id IS NOT NULL
            GROUP BY f.group_id
            HAVING COUNT(*) > 1
            ORDER BY f.size DESC
        `
      )
      .all(scanId);
  }

  deleteFile(filePath) {
    return this.db.prepare("DELETE FROM files WHERE path = ?").run(filePath);
  }

  updateFilePath(oldPath, newPath) {
    return this.db
      .prepare("UPDATE files SET path = ? WHERE path = ?")
      .run(newPath, oldPath);
  }

  close() {
    this.db.close();
  }

  static generateIndexPath(baseDir) {
    const randomHex = crypto.randomBytes(4).toString("hex");
    return path.join(baseDir, `.super-dee-duper.${randomHex}`);
  }
}
