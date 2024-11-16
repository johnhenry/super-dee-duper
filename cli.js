#!/usr/bin/env node
import { program } from "commander";
import { findDuplicates } from "./scanner.js";
import { startWebInterface } from "./web-interface.js";
import { displayConsoleResults } from "./console-output.js";

program
  .name("dupe-scan")
  .description("Scan directory for duplicate files")
  .argument("[dir]", "Directory to scan", ".")
  .option("-r, --recursive", "Scan directories recursively", false)
  .option("-n, --no-web", "Disable web interface, show results in console") // Removed default value
  .option("-p, --port <number>", "Port for web interface", "8080")
  .action(async (dir, options) => {
    try {
      const duplicates = await findDuplicates(dir, options.recursive);

      // Default to web interface if -n/--no-web is not specified
      const useWeb = options.web ?? true;

      if (useWeb) {
        const port = parseInt(options.port, 10);
        console.log("\n🔍 Starting web interface...");
        await startWebInterface(duplicates, port);
      } else {
        displayConsoleResults(duplicates);
      }
    } catch (error) {
      console.error("Error:", error.message);
      process.exit(1);
    }
  });

program.parse();
