# Duplicate File Scanner

A powerful tool for finding and managing duplicate files with both CLI and web interfaces.

## Features

- Find duplicate files using secure hash comparison
- Interactive web interface for managing duplicates
- Console output for quick scanning
- Batch rename capabilities
- File preview support
- Dark mode support
- Space savings analysis
- File type filtering
- Test file generation for development

## Installation

```bash
# Clone the repository
git clone [repository-url]
cd dupe-scanner

# Install dependencies
npm install
```

## Usage

### Command Line Interface

1. Scan for duplicates:

```bash
# Scan current directory
node cli.mjs scan

# Scan specific directory recursively
node cli.mjs scan ./test-dir -r

# Show results in console instead of web interface
node cli.mjs scan ./test-dir -r -n
```

2. Generate test files (for development/testing):

```bash
# Generate test files with default settings
node cli.mjs generate-test

# Generate specific number of files with duplicates
node cli.mjs generate-test ./test-dir -c 10 -d 2
```

### CLI Options

- `scan [dir]` - Scan directory for duplicates (default: current directory)

  - `-r, --recursive` - Scan directories recursively
  - `-n, --no-web` - Show results in console instead of web interface
  - `-p, --port <number>` - Specify port for web interface (default: 8080)

- `generate-test [dir]` - Generate test files
  - `-c, --count <number>` - Number of unique files to generate (default: 20)
  - `-d, --duplicates <number>` - Number of duplicates per file (default: 2)

### Web Interface

The web interface provides an interactive way to manage duplicate files:

1. **View Duplicates**

   - Files are grouped by content
   - Each group shows file size and hash
   - Collapsible groups for better organization

2. **File Management**

   - Preview files (images and text)
   - Rename files individually
   - Batch rename with patterns:
     - `{n}` - Original filename
     - `{i}` - Index number
     - `{ext}` - File extension

3. **Filtering**

   - Filter by file path
   - Filter by file size
   - Filter by file type

4. **Statistics**
   - Total number of duplicate groups
   - Total number of files
   - Total size
   - Potential space savings

## Development

### Running Tests

```bash
# Run tests once
npm test

# Run tests in watch mode
npm run test:watch
```

### Test File Generation

Generate test files for development:

```bash
# Generate in test-dir
npm run generate

# Or specify custom parameters
node cli.mjs generate-test ./test-dir -c 10 -d 2
```

### Project Structure

```
dupe-scanner/
├── cli.mjs              # Command line interface
├── scanner.mjs          # Core duplicate scanning logic
├── web-interface.mjs    # Web interface server
├── console-output.mjs   # Console output formatting
├── generate-test-files.mjs  # Test file generator
├── public/             # Web interface static files
│   └── index.html      # Web interface frontend
└── tests/              # Test files
    └── scanner.test.mjs # Scanner unit tests
```

## Example Workflow

1. Generate some test files:

```bash
node cli.mjs generate-test ./test-dir -c 5 -d 2
```

2. Scan for duplicates with web interface:

```bash
node cli.mjs scan ./test-dir -r
```

3. Open your browser to http://localhost:8080 to manage duplicates

4. Or view results in console:

```bash
node cli.mjs scan ./test-dir -r -n
```
