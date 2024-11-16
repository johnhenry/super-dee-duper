#!/usr/bin/env node
import { program } from "commander";
import { findDuplicates } from "./scanner.mjs";
import { startWebInterface } from "./web-interface.mjs";
import { displayConsoleResults } from "./console-output.mjs";
import { generateTestFiles } from "./generate-test-files.mjs";

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
