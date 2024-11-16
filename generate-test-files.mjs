import fs from "fs/promises";
import path from "path";
import crypto from "crypto";

const FILE_TYPES = [
  { ext: ".txt", prefix: "document_" },
  { ext: ".pdf", prefix: "report__" },
  { ext: ".jpg", prefix: "IMG__" },
  { ext: ".png", prefix: "DSC__" },
  { ext: ".doc", prefix: "backup_" },
  { ext: ".pdf", prefix: "meeting_notes_" },
  { ext: ".pdf", prefix: "screenshot_" },
  { ext: ".txt", prefix: "vacation_photo_" },
];

function generateRandomContent() {
  return crypto.randomBytes(Math.floor(Math.random() * 1024 * 1024) + 1024); // 1KB to 1MB
}

function getRandomDate() {
  const start = new Date(2023, 0, 1);
  const end = new Date(2024, 11, 31);
  return new Date(
    start.getTime() + Math.random() * (end.getTime() - start.getTime())
  );
}

function formatDate(date) {
  return date.toISOString().split("T")[0].replace(/-/g, "-");
}

function generateFileName(fileType, index) {
  const date = formatDate(getRandomDate());
  const number = Math.floor(Math.random() * 1000)
    .toString()
    .padStart(3, "0");
  return `${fileType.prefix}${date}_${number}${fileType.ext}`;
}

export async function generateTestFiles(
  baseDir,
  count = 20,
  duplicatesPerFile = 2
) {
  if (count < 1) throw new Error("Count must be greater than 0");
  if (duplicatesPerFile < 1)
    throw new Error("Duplicates must be greater than 0");

  // Create base directory if it doesn't exist
  await fs.mkdir(baseDir, { recursive: true });

  // Create subdirectories
  const subdirs = ["documents", "photos", "downloads"].map((dir) =>
    path.join(baseDir, dir)
  );
  for (const dir of subdirs) {
    await fs.mkdir(dir, { recursive: true });
  }

  // Generate unique files with duplicates
  for (let i = 0; i < count; i++) {
    const content = generateRandomContent();
    const fileType = FILE_TYPES[Math.floor(Math.random() * FILE_TYPES.length)];

    // Create duplicates of each file
    for (let j = 0; j < duplicatesPerFile; j++) {
      const fileName = generateFileName(fileType, i);
      // For first copy, use base directory, for others use random subdirectory
      const targetDir =
        j === 0 ? baseDir : subdirs[Math.floor(Math.random() * subdirs.length)];
      const filePath = path.join(targetDir, fileName);

      try {
        await fs.writeFile(filePath, content);
        console.log(`Created: ${filePath}`);
      } catch (error) {
        console.error(`Failed to create ${filePath}:`, error.message);
        throw error;
      }
    }
  }

  console.log("\n✨ Test files generated successfully!");
}
