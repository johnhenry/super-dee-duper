# Duplicate File Scanner

A powerful CLI tool for finding and managing duplicate files in your system. It provides both command-line output and an interactive web interface for managing duplicates.

## Features

- Scan directories for duplicate files using SHA-256 hash comparison
- Recursive directory scanning
- Interactive web interface for managing duplicates
- Command-line output option
- File management operations:
  - Download files
  - Delete duplicates
  - Rename files
- Real-time updates in web interface

## Installation

```bash
npm install
chmod +x cli.js
```

## Usage

### Basic Scanning

```bash
./cli.js [directory]
```

### Options

- `-r, --recursive`: Scan directories recursively
- `-n, --no-web`: Disable web interface and show results in console

### Examples

Scan current directory:
```bash
./cli.js
```

Scan directory recursively:
```bash
./cli.js -r /path/to/directory
```

Show results in console only:
```bash
./cli.js -n /path/to/directory
```

### Generate Test Files

To create a test directory with duplicate files for testing:

```bash
./generate-test-files.js
```

## Web Interface

The web interface provides an intuitive way to manage duplicate files:

- View groups of duplicate files
- Download any file
- Delete unwanted duplicates
- Rename files
- See file sizes and paths

The interface automatically opens in your default browser when you run the tool without the `-n` flag.

## Technical Details

- Uses SHA-256 for file comparison
- Built with Node.js and Express
- Provides both CLI and web interfaces
- Real-time file system operations
- Efficient handling of large files

## License

MIT