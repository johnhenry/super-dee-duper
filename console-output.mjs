import Table from "cli-table3";
import path from "path";

function formatSize(bytes) {
  const units = ["B", "KB", "MB", "GB", "TB"];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(2)} ${units[unitIndex]}`;
}

export function displayConsoleResults(duplicates) {
  if (duplicates.length === 0) {
    console.log("\n✨ No duplicate files found");
    return;
  }

  // Calculate total statistics
  const totalGroups = duplicates.length;
  const totalFiles = duplicates.reduce((sum, group) => sum + group.length, 0);
  const totalSize = duplicates.reduce(
    (sum, group) => sum + group[0].size * group.length,
    0
  );
  const potentialSavings = duplicates.reduce(
    (sum, group) => sum + group[0].size * (group.length - 1),
    0
  );

  // Display summary
  console.log("\n📊 Summary:");
  console.log("==========================================");
  console.log(`📁 Total duplicate groups: ${totalGroups}`);
  console.log(`📄 Total duplicate files: ${totalFiles}`);
  console.log(`💾 Total size: ${formatSize(totalSize)}`);
  console.log(`✨ Potential space savings: ${formatSize(potentialSavings)}`);
  console.log("==========================================\n");

  // Create and configure table
  const table = new Table({
    head: ["Group", "Size", "Hash", "Files"],
    style: {
      head: ["cyan"],
      border: ["gray"],
    },
    wordWrap: true,
    wrapOnWordBoundary: false,
  });

  // Add duplicate groups to table
  duplicates.forEach((group, index) => {
    const files = group
      .map((file) => {
        const basename = path.basename(file.path);
        const dirname = path.dirname(file.path);
        return `${dirname}/\x1b[1m${basename}\x1b[0m`;
      })
      .join("\n");

    table.push([
      `Group ${index + 1}`,
      group[0].formattedSize,
      group[0].hash.slice(0, 8),
      files,
    ]);
  });

  // Display table
  console.log(table.toString());
  console.log(
    "\n💡 Tip: Use the web interface (-w flag) for interactive management of duplicate files"
  );
}
