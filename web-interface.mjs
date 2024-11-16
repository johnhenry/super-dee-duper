import express from "express";
import open from "open";
import fs from "fs/promises";
import { createReadStream } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import mime from "mime-types";
import { ScanDatabase } from "./database.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export async function startWebInterface(
  duplicates,
  port = 8080,
  dbPath,
  scanId
) {
  const app = express();
  app.use(express.json());
  app.use(express.static(path.join(__dirname, "public")));

  // Initialize database connection
  const db = dbPath ? new ScanDatabase(dbPath) : null;

  app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "index.html"));
  });

  app.get("/api/duplicates", (req, res) => {
    if (db) {
      const groups = db.getDuplicateGroups(scanId);
      // Fix: Parse the JSON string before sending
      res.json(groups.map((g) => JSON.parse(g.files)));
    } else {
      res.json(duplicates);
    }
  });

  app.get("/api/scan-info", (req, res) => {
    if (db) {
      const info = db.getScanInfo(scanId);
      res.json({
        baseDirectory: info.base_directory,
        startTime: info.start_time,
        endTime: info.end_time,
        filesScanned: info.files_scanned,
        groupsFound: info.groups_found,
      });
    } else {
      res.json(null);
    }
  });

  app.get("/api/download/:encodedPath", async (req, res) => {
    try {
      const filePath = decodeURIComponent(req.params.encodedPath);

      // Verify file exists
      await fs.access(filePath);

      const fileName = path.basename(filePath);
      const mimeType = mime.lookup(filePath) || "application/octet-stream";

      // For media files and text files, allow display in browser
      const inlineTypes = [
        "text/",
        "image/",
        "video/",
        "audio/",
        "application/pdf",
      ];
      const disposition = inlineTypes.some((type) => mimeType.startsWith(type))
        ? "inline"
        : "attachment";

      res.setHeader("Content-Type", mimeType);
      res.setHeader(
        "Content-Disposition",
        `${disposition}; filename="${encodeURIComponent(fileName)}"`
      );

      // Stream the file
      const stream = createReadStream(filePath);
      stream.pipe(res);
    } catch (error) {
      res.status(500).json({
        error: "Failed to download file",
        details: error.message,
      });
    }
  });

  app.post("/api/delete", async (req, res) => {
    const { filePath } = req.body;

    try {
      // Verify file exists before attempting deletion
      await fs.access(filePath);

      await fs.unlink(filePath);

      if (db) {
        db.deleteFile(filePath);
      }

      res.json({
        success: true,
        message: `Successfully deleted ${filePath}`,
      });
    } catch (error) {
      res.status(500).json({
        error: "Failed to delete file",
        details: error.message,
      });
    }
  });

  app.post("/api/rename", async (req, res) => {
    const { oldPath, newName } = req.body;

    try {
      // Input validation
      if (!newName || newName.includes(path.sep)) {
        throw new Error("Invalid new filename");
      }

      // Verify source file exists
      await fs.access(oldPath);

      const dir = path.dirname(oldPath);
      const newPath = path.join(dir, newName);

      // Check if target already exists
      try {
        await fs.access(newPath);
        throw new Error("A file with that name already exists");
      } catch (error) {
        // Error means file doesn't exist, which is what we want
        if (error.code !== "ENOENT") throw error;
      }

      await fs.rename(oldPath, newPath);

      // Get updated file stats
      const stats = await fs.stat(newPath);

      if (db) {
        // Update the file path in the database
        db.updateFilePath(oldPath, newPath);
      }

      res.json({
        success: true,
        newPath,
        message: `Successfully renamed ${oldPath} to ${newPath}`,
      });
    } catch (error) {
      res.status(500).json({
        error: "Failed to rename file",
        details: error.message,
      });
    }
  });

  app.post("/api/shutdown", async (req, res) => {
    const { deleteIndex } = req.body;

    if (deleteIndex && dbPath) {
      try {
        // Close database connection
        if (db) {
          db.close();
        }
        // Delete the index file
        await fs.unlink(dbPath);
      } catch (error) {
        console.error("Failed to delete index file:", error);
      }
    }

    res.json({
      success: true,
      message: "Server shutting down",
    });

    // Use setTimeout to ensure the response is sent before shutting down
    setTimeout(() => {
      process.exit(0);
    }, 100);
  });

  return new Promise((resolve, reject) => {
    try {
      const server = app.listen(port, async () => {
        const url = `http://localhost:${port}`;
        console.log("\n🔍 super-dee-duper Web Interface");
        console.log("==========================================");
        console.log(`✨ Server started at: ${url}`);
        if (db) {
          const info = db.getScanInfo(scanId);
          console.log(`📁 Base directory: ${info.base_directory}`);
          console.log(`📊 Files scanned: ${info.files_scanned}`);
          console.log(`🔍 Groups found: ${info.groups_found}`);
          if (info.end_time) {
            const duration = info.end_time - info.start_time;
            console.log(`⏱️  Scan time: ${Math.round(duration / 1000)}s`);
          }
        } else {
          console.log("📁 Found duplicates:", duplicates.length, "groups");
        }
        console.log("==========================================\n");

        try {
          await open(url, {
            wait: false,
            url: true,
          });
        } catch (err) {
          console.error("Failed to open browser:", err.message);
          console.log(`Please open ${url} manually in your browser.`);
        }

        resolve(server);
      });

      server.on("error", (err) => {
        if (err.code === "EADDRINUSE") {
          reject(
            new Error(
              `Port ${port} is already in use. Try a different port with --port option.`
            )
          );
        } else {
          reject(err);
        }
      });
    } catch (error) {
      reject(error);
    }
  });
}
