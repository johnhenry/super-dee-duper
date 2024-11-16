#!/usr/bin/env node
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

const TEST_DIR = 'test-dir';
const SUBDIRS = ['photos', 'documents', 'downloads'];
const FILE_PREFIXES = [
  'vacation_photo', 'screenshot', 'document', 'backup',
  'IMG_', 'DSC_', 'report_', 'meeting_notes'
];
const FILE_EXTENSIONS = ['.jpg', '.png', '.pdf', '.txt', '.doc'];

function generateRandomContent(size = 1024) {
  return crypto.randomBytes(size);
}

function getRandomElement(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateFileName() {
  const prefix = getRandomElement(FILE_PREFIXES);
  const date = new Date(Date.now() - Math.random() * 31536000000) // Random date within last year
    .toISOString()
    .split('T')[0];
  const randomNum = Math.floor(Math.random() * 1000)
    .toString()
    .padStart(3, '0');
  const ext = getRandomElement(FILE_EXTENSIONS);
  return `${prefix}_${date}_${randomNum}${ext}`;
}

async function createTestFiles() {
  // Create main test directory and subdirectories
  await fs.mkdir(TEST_DIR, { recursive: true });
  await Promise.all(SUBDIRS.map(dir => 
    fs.mkdir(path.join(TEST_DIR, dir), { recursive: true })
  ));

  // Generate some content blocks to create duplicates
  const contentBlocks = [
    generateRandomContent(1024),     // 1KB
    generateRandomContent(2048),     // 2KB
    generateRandomContent(4096),     // 4KB
    generateRandomContent(1024 * 16) // 16KB
  ];

  // Create 20 files (mix of unique and duplicates)
  const files = [];
  for (let i = 0; i < 20; i++) {
    const fileName = generateFileName();
    const dir = getRandomElement([TEST_DIR, ...SUBDIRS.map(d => path.join(TEST_DIR, d))]);
    const filePath = path.join(dir, fileName);
    
    // 40% chance of creating a duplicate
    const content = Math.random() < 0.4 
      ? getRandomElement(contentBlocks) 
      : generateRandomContent(1024 + Math.random() * 4096);
    
    files.push({ path: filePath, content });
  }

  // Write all files
  await Promise.all(files.map(file => 
    fs.writeFile(file.path, file.content)
  ));

  console.log('Test files created successfully!');
  console.log(`Created ${files.length} files across ${SUBDIRS.length + 1} directories`);
  console.log('Run the duplicate scanner with:');
  console.log('  ./cli.js -r test-dir');
}

createTestFiles();