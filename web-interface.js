import express from "express";
import open from "open";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export async function startWebInterface(duplicates, port = 8080) {
  const app = express();
  app.use(express.json());
  app.use(express.static(path.join(__dirname, "public")));

  // The duplicates are already in the correct format from scanner.js
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
      const fileName = path.basename(filePath);
      res.download(filePath, fileName);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/delete", async (req, res) => {
    const { filePath } = req.body;
    try {
      await fs.unlink(filePath);
      // Update the groups after deletion
      dupeGroups = dupeGroups
        .map((group) => group.filter((file) => file.path !== filePath))
        .filter((group) => group.length > 1);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/rename", async (req, res) => {
    const { oldPath, newName } = req.body;
    try {
      const dir = path.dirname(oldPath);
      const newPath = path.join(dir, newName);
      await fs.rename(oldPath, newPath);

      // Update the file path in our data structure
      dupeGroups = dupeGroups.map((group) =>
        group.map((file) =>
          file.path === oldPath ? { ...file, path: newPath } : file
        )
      );

      res.json({ success: true, newPath });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/shutdown", (req, res) => {
    res.json({ success: true });
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
