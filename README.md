# JSON Side

A simple and efficient Chrome/Edge browser extension for JSON formatting, diff comparison, and type conversion.

## Features

### 📝 JSON Formatting

- **Right-click to format**: Select JSON text on any webpage, right-click "Format JSON" to view formatted result in a new tab
- **Syntax highlighting**: Keys, strings, numbers, booleans, and null are displayed in different colors
- **Collapsible**: Objects and arrays can be collapsed for easier viewing of large JSON
- **Timestamp conversion**: Automatically identifies timestamps, click to convert to readable date/time

### 🔍 JSON Diff

- **Side-by-side comparison**: Paste JSON on left and right panels, one-click to compare differences
- **Diff highlighting**:
  - 🟢 Green: Added content
  - 🔴 Red: Deleted content
  - 🟠 Orange: Modified content
- **Statistics display**: Automatically counts additions, deletions, and modifications
- **Editable**: Paste and edit directly, click Compare button to re-compare

### 🔄 JSON Type Conversion

- **TypeScript interface generation**: Automatically generate TypeScript interface definitions from JSON
- **Go struct generation**: Automatically generate Go struct definitions from JSON
- **YAML conversion**: Convert JSON to YAML format
- **Real-time preview**: Automatically displays conversion results after entering JSON
- **One-click copy**: Quickly copy conversion results

### 🔗 JSON Path Query

- Supports standard JSON Path syntax
- Property access: `$.store.book`
- Array index: `$[0]`, `$[-1]` (supports negative index)
- Recursive descent: `$..title` (find all title properties)
- Wildcard: `$[*]`, `$.*` (get all elements/properties)
- Multi-index: `$[0,2,4]` (get multiple specified indices)
- Real-time query: Automatically displays results when entering path

### 📦 JSON Compact/Escape

- **Compact**: Compress formatted JSON to a single line (remove spaces and line breaks)
- **Escape**: Escape JSON as a string (for embedding in code or config files)
- **Unescape**: Restore escaped JSON string to formatted JSON
- **One-click copy**: Quickly copy processed results

### 📜 History

- **Auto-save**: Formatted JSON is automatically saved to local history
- **Source marking**: Distinguish between right-click menu and manual input
- **Timezone support**: Time display supports 24 global timezones
- **Quick load**: Click history record to quickly load and format

### ⏰ Timestamp Support

- **Hover tooltip**: Hover over timestamp numbers on any webpage to see formatted time
- **Click to convert**: Click timestamp numbers in formatted results for one-click conversion
- **Timezone selection**: Supports 24 global timezones

## Free vs Pro

| Feature | Free | Pro |
|---------|------|-----|
| Diff comparisons | 3 per day | Unlimited |
| Diff size limit | 10KB | 2MB |
| Format Time | 3 per day | Unlimited |
| History records | 10 | 100 |
| JSON formatting | ✓ | ✓ |
| JSON conversion | ✓ | ✓ |
| JSON Path query | ✓ | ✓ |
| JSON compact/escape | ✓ | ✓ |
| Timestamp hover | ✓ | ✓ |
| Timezone selection | ✓ | ✓ |
| **Price** | Free | **Free** (limited time) |

## Installation

### Chrome

1. Open Chrome and go to `chrome://extensions/`
2. Enable "Developer mode" in the top right
3. Click "Load unpacked"
4. Select this project folder

### Edge

1. Open Edge and go to `edge://extensions/`
2. Enable "Developer mode" in the bottom left
3. Click "Load unpacked"
4. Select this project folder

## Usage

### Format Mode

1. Click the extension icon or right-click and select "Format JSON"
2. Paste JSON text in the left input box
3. Click "Format" button or press `Ctrl + Enter`
4. View formatted result on the right
5. Click timestamp numbers to convert to date/time

### Diff Mode

1. Click "Diff" button in toolbar to switch to comparison mode
2. Paste JSON A on the left
3. Paste JSON B on the right
4. Click "Compare" button to compare
5. Differences are automatically highlighted
6. Click "Swap" to swap left and right content
7. Click "Clear" to clear all content

### Convert Mode

1. Click "Convert" button in toolbar to switch to convert mode
2. Paste JSON text in the left input box
3. View conversion result on the right automatically
4. Click "TypeScript", "Go struct", "YAML" tabs to switch conversion type
5. Click "Copy" button to copy conversion result

### JSON Path Mode

1. Click "Path" button in toolbar to switch to query mode
2. Paste JSON text in the left input box
3. Enter JSON Path expression in the right input box
4. View query results automatically, or press Enter/click "Query" button
5. Supported syntax examples:
   - `$.store.book[0].title` - Get title of first book
   - `$..title` - Get all title properties
   - `$.store.book[*]` - Get all book elements
   - `$[0,2,4]` - Get elements at indices 0, 2, 4

### Compact/Escape Mode

1. Click "Compact" button in toolbar to switch to process mode
2. Paste JSON text in the left input box
3. Click corresponding button to execute operation:
   - **Compact**: Remove spaces and line breaks, output single-line JSON
   - **Escape**: Escape JSON to string format
   - **Unescape**: Restore escaped string to formatted JSON
4. Click "Copy" to copy processed content

### History

1. Click "History" button in toolbar to open sidebar
2. Click any history record to load and format
3. Click "Delete" button to delete single record
4. Click "Clear All" to delete all history records

## File Structure

```
├── manifest.json     # Extension configuration
├── background.js     # Service Worker, handles context menu
├── content.js        # Content script, timestamp hover tooltip
├── popup.html        # Main interface
└── popup.js          # Main logic
```

## Tech Stack

- Vanilla JavaScript (no framework dependencies)
- Chrome Extension Manifest V3
- CSS Grid layout
- Dark theme UI

## License

MIT License
