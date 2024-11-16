import Table from 'cli-table3';

export function displayConsoleResults(duplicates) {
  console.log(`Found ${duplicates.length} groups of duplicate files:\n`);

  duplicates.forEach((group, index) => {
    const table = new Table({
      head: ['Path', 'Size (bytes)'],
      colWidths: [60, 15]
    });

    group.forEach(file => {
      table.push([file.path, file.size.toString()]);
    });

    console.log(`Group ${index + 1} (Hash: ${group[0].hash.slice(0, 8)}...):`);
    console.log(table.toString());
    console.log();
  });
}