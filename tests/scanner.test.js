import { jest } from "@jest/globals";
import { findDuplicates } from "../scanner.mjs";
import { generateTestFiles } from "../generate-test-files.mjs";
import fs from "fs/promises";
import path from "path";
import crypto from "crypto";

async function cleanDirectory(dir) {
  try {
    const files = await fs.readdir(dir, { withFileTypes: true });
    for (const file of files) {
      const fullPath = path.join(dir, file.name);
      if (file.isDirectory()) {
        await cleanDirectory(fullPath);
        await fs.rmdir(fullPath);
      } else {
        await fs.unlink(fullPath);
      }
    }
  } catch (error) {
    console.error(`Error cleaning directory ${dir}:`, error);
  }
}

async function getAllFiles(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const fullPath = path.join(dir, entry.name);
      return entry.isDirectory() ? getAllFiles(fullPath) : fullPath;
    })
  );
  return files.flat();
}

describe("Scanner", () => {
  const TEST_DIR = path.join(process.cwd(), "test-output");

  beforeAll(async () => {
    // Create test directory if it doesn't exist
    try {
      await fs.mkdir(TEST_DIR, { recursive: true });
    } catch (error) {
      if (error.code !== "EEXIST") throw error;
    }
  });

  afterAll(async () => {
    // Clean up test directory
    try {
      await fs.rm(TEST_DIR, { recursive: true, force: true });
    } catch (error) {
      console.error("Error cleaning up:", error);
    }
  });

  beforeEach(async () => {
    // Clear test directory before each test
    await cleanDirectory(TEST_DIR);
  });

  test("should find duplicate files", async () => {
    // Create test files with known content
    const content1 = "test content 1";
    const content2 = "test content 2";

    await fs.writeFile(path.join(TEST_DIR, "file1.txt"), content1);
    await fs.writeFile(path.join(TEST_DIR, "file2.txt"), content1); // Duplicate of file1
    await fs.writeFile(path.join(TEST_DIR, "file3.txt"), content2);
    await fs.writeFile(path.join(TEST_DIR, "file4.txt"), content2); // Duplicate of file3

    const duplicates = await findDuplicates(TEST_DIR, false);

    expect(duplicates).toHaveLength(2); // Should find 2 groups of duplicates
    expect(duplicates[0]).toHaveLength(2); // Each group should have 2 files
    expect(duplicates[1]).toHaveLength(2);
  });

  test("should handle empty directory", async () => {
    const duplicates = await findDuplicates(TEST_DIR, false);
    expect(duplicates).toHaveLength(0);
  });

  test("should handle recursive scanning", async () => {
    // Create nested directory structure
    const subDir = path.join(TEST_DIR, "subdir");
    await fs.mkdir(subDir, { recursive: true });

    const content = "test content";
    await fs.writeFile(path.join(TEST_DIR, "file1.txt"), content);
    await fs.writeFile(path.join(subDir, "file2.txt"), content);

    // Test with recursive flag off
    let duplicates = await findDuplicates(TEST_DIR, false);
    expect(duplicates).toHaveLength(0);

    // Test with recursive flag on
    duplicates = await findDuplicates(TEST_DIR, true);
    expect(duplicates).toHaveLength(1);
    expect(duplicates[0]).toHaveLength(2);
  });

  test("should handle large files", async () => {
    const largeContent = crypto.randomBytes(5 * 1024 * 1024); // 5MB
    await fs.writeFile(path.join(TEST_DIR, "large1.bin"), largeContent);
    await fs.writeFile(path.join(TEST_DIR, "large2.bin"), largeContent);

    const duplicates = await findDuplicates(TEST_DIR, false);
    expect(duplicates).toHaveLength(1);
    expect(duplicates[0]).toHaveLength(2);
  });

  test("should correctly format file sizes", async () => {
    const content = crypto.randomBytes(1024 * 1024); // 1MB
    await fs.writeFile(path.join(TEST_DIR, "file1.bin"), content);
    await fs.writeFile(path.join(TEST_DIR, "file2.bin"), content);

    const duplicates = await findDuplicates(TEST_DIR, false);
    expect(duplicates[0][0].formattedSize).toBe("1.00 MB");
  });
});

describe("Test File Generator", () => {
  const TEST_DIR = path.join(process.cwd(), "test-output");

  beforeAll(async () => {
    try {
      await fs.mkdir(TEST_DIR, { recursive: true });
    } catch (error) {
      if (error.code !== "EEXIST") throw error;
    }
  });

  afterAll(async () => {
    try {
      await fs.rm(TEST_DIR, { recursive: true, force: true });
    } catch (error) {
      console.error("Error cleaning up:", error);
    }
  });

  beforeEach(async () => {
    await cleanDirectory(TEST_DIR);
  });

  test("should generate correct number of files and duplicates", async () => {
    const fileCount = 5;
    const duplicateCount = 3;

    await generateTestFiles(TEST_DIR, fileCount, duplicateCount);

    const allFiles = await getAllFiles(TEST_DIR);
    expect(allFiles.length).toBe(fileCount * duplicateCount);

    const duplicates = await findDuplicates(TEST_DIR, true);
    expect(duplicates).toHaveLength(fileCount);
    duplicates.forEach((group) => {
      expect(group).toHaveLength(duplicateCount);
    });
  });

  test("should generate files with different types", async () => {
    await generateTestFiles(TEST_DIR, 10, 2);

    const allFiles = await getAllFiles(TEST_DIR);
    const extensions = new Set(allFiles.map((file) => path.extname(file)));

    // Should have multiple different extensions
    expect(extensions.size).toBeGreaterThan(1);
  });

  test("should handle invalid input", async () => {
    await expect(generateTestFiles(TEST_DIR, -1, 2)).rejects.toThrow();
    await expect(generateTestFiles(TEST_DIR, 1, -1)).rejects.toThrow();
  });
});
