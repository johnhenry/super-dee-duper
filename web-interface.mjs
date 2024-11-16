import express from "express";
import open from "open";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import mime from "mime-types";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export async function startWebInterface(duplicates, port = 8080) {
  const app = express();
  app.use(express.json());
  app.use(express.static(path.join(__dirname, "public")));

  // Store duplicates with all metadata
  let dupeGroups = duplicates;

  app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "index.html"));
  });

  app.get("/api/duplicates", (req, res) => {
    res.json(dupeGroups);
  });

  app.get("/api/download/:encodedPath", async (req, res) => {
    try {
      const filePath = decodeURIComponent(req.params.encodedPath);

      // Verify file exists
      await fs.access(filePath);

      const fileName = path.basename(filePath);
      const mimeType = mime.lookup(filePath) || "application/octet-stream";

      // For text files and images, allow display in browser
      const disposition =
        mimeType.startsWith("text/") || mimeType.startsWith("image/")
          ? "inline"
          : "attachment";

      res.setHeader("Content-Type", mimeType);
      res.setHeader(
        "Content-Disposition",
        `${disposition}; filename="${encodeURIComponent(fileName)}"`
      );

      res.download(filePath, fileName);
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

      // Update the groups after deletion
      dupeGroups = dupeGroups
        .map((group) => group.filter((file) => file.path !== filePath))
        .filter((group) => group.length > 1);

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

      // Update the file path and metadata in our data structure
      dupeGroups = dupeGroups.map((group) =>
        group.map((file) =>
          file.path === oldPath
            ? {
                ...file,
                path: newPath,
                name: newName,
                modified: stats.mtime,
              }
            : file
        )
      );

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

  app.post("/api/shutdown", (req, res) => {
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
        console.log("\n🔍 Duplicate File Scanner Web Interface");
        console.log("==========================================");
        console.log(`✨ Server started at: ${url}`);
        console.log("📁 Found duplicates:", dupeGroups.length, "groups");
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
