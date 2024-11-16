#!/usr/bin/env node
import { program } from "commander";
import { findDuplicates } from "./scanner.mjs";
import { startWebInterface } from "./web-interface.mjs";
import { displayConsoleResults } from "./console-output.mjs";
import { generateTestFiles } from "./generate-test-files.mjs";
import { ScanDatabase } from "./database.mjs";
import fs from "fs/promises";
import path from "path";
import prettyMs from "pretty-ms";

program
  .name("super-dee-duper")
  .description("Scan directory for duplicate files")
  .version("1.0.0");

program
  .command("scan")
  .description("Scan directory for duplicate files")
  .argument("[dir]", "Directory to scan", ".")
  .option("-r, --recursive", "Scan directories recursively", false)
  .option("-n, --no-web", "Disable web interface, show results in console")
  .option("-p, --port <number>", "Port for web interface", "8080")
  .option("-i, --index <path>", "Path to store the index file")
  .option("--incomplete", "Resume an incomplete scan")
  .option("-e, --exclude <patterns...>", "Glob patterns to exclude")
  .action(async (dir, options) => {
    try {
      let startTime = Date.now();
      let lastUpdate = Date.now();

      const { result, dbPath, scanId } = await findDuplicates(dir, {
        recursive: options.recursive,
        exclude: options.exclude || [],
        indexPath: options.index,
        incomplete: options.incomplete,
        onProgress: ({ filesScanned, groupsFound, phase }) => {
          // Update progress at most once per second
          const now = Date.now();
          if (now - lastUpdate > 1000) {
            const elapsed = prettyMs(now - startTime);
            console.log(
              `\r${phase === "scanning" ? "🔍" : "🔄"} ` +
                `Processed ${filesScanned} files, found ${groupsFound} groups ` +
                `(${elapsed})`
            );
            lastUpdate = now;
          }
        },
      });

      // Default to web interface if -n/--no-web is not specified
      const useWeb = options.web ?? true;

      if (useWeb) {
        const port = parseInt(options.port, 10);
        console.log("\n🔍 Starting web interface...");
        await startWebInterface(result, port, dbPath, scanId);
      } else {
        displayConsoleResults(result);
      }
    } catch (error) {
      console.error("Error:", error.message);
      process.exit(1);
    }
  });

program
  .command("serve")
  .description("Serve an existing index file")
  .argument("<index-file>", "Path to the index file")
  .option("-p, --port <number>", "Port for web interface", "8080")
  .action(async (indexFile, options) => {
    try {
      // Verify the index file exists
      await fs.access(indexFile);

      const db = new ScanDatabase(indexFile);
      const scanInfo = db.getScanInfo(1); // Get the first scan

      if (!scanInfo) {
        throw new Error("Invalid or corrupted index file");
      }

      const duplicates = db.getDuplicateGroups(1);
      const port = parseInt(options.port, 10);

      console.log("\n📂 Loading index file...");
      console.log(`Base directory: ${scanInfo.base_directory}`);
      console.log(
        `Scan time: ${prettyMs(scanInfo.end_time - scanInfo.start_time)}`
      );
      console.log(`Files scanned: ${scanInfo.files_scanned}`);
      console.log(`Groups found: ${scanInfo.groups_found}`);

      await startWebInterface(duplicates, port, indexFile, 1);
    } catch (error) {
      console.error("Error:", error.message);
      process.exit(1);
    }
  });

program
  .command("shutdown")
  .description("Shutdown the server")
  .option("-d, --delete-index", "Delete the index file after shutdown")
  .action(async (options) => {
    try {
      const response = await fetch("http://localhost:8080/api/shutdown", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deleteIndex: options.deleteIndex }),
      });

      if (!response.ok) {
        throw new Error("Failed to shutdown server");
      }

      console.log("✨ Server shutdown successfully");
    } catch (error) {
      console.error("Error:", error.message);
      process.exit(1);
    }
  });

program
  .command("generate-test")
  .description("Generate test files for testing duplicate detection")
  .argument("[dir]", "Directory to generate test files in", "./test-dir")
  .option("-c, --count <number>", "Number of files to generate", "20")
  .option(
    "-d, --duplicates <number>",
    "Number of duplicates for each file",
    "2"
  )
  .action(async (dir, options) => {
    try {
      const count = parseInt(options.count, 10);
      const duplicates = parseInt(options.duplicates, 10);

      console.log(
        `\n📁 Generating ${count} files with ${duplicates} duplicates each in ${dir}...`
      );
      await generateTestFiles(dir, count, duplicates);
      console.log("✨ Test files generated successfully!");
    } catch (error) {
      console.error("Error:", error.message);
      process.exit(1);
    }
  });

program.parse();
