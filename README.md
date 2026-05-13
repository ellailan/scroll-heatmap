# Scroll Heat Map Extension

A simple Chrome extension that visualizes scroll depth data as a heatmap overlay on any website.

## Features

- Upload CSV files with scroll depth data
- Visual heatmap overlay showing user engagement at different scroll depths
- Works on any website
- Data persists across sessions

## Installation

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" in the top right corner
3. Click "Load unpacked" and select the `scroll-heatmap-extension` folder
4. The extension icon will appear in your toolbar

## Usage

1. Click the extension icon in your Chrome toolbar
2. Click "Upload CSV File" and select your CSV file
3. The CSV should contain scroll depth events in the format `scroll_to_XX` with event counts
4. Toggle "Show Heat Map" to display the heatmap on the current page
5. The heatmap will appear on the right side of the page

## CSV Format

The extension expects a CSV file with the following columns:
- `Event name` - containing values like `scroll_to_10`, `scroll_to_25`, `scroll_to_50`, `scroll_to_75`, `scroll_to_90`
- `Event count` - the number of users who scrolled to that depth

Example:
```csv
First session date,Event name,Event count
,scroll_to_10,90
,scroll_to_25,54
,scroll_to_50,50
,scroll_to_75,41
,scroll_to_90,37
```

## Heatmap Colors

- **Red/Orange** - High engagement (many users scrolled to this point)
- **Yellow/Green** - Medium engagement
- **Blue** - Low engagement (few users scrolled this far)

## Files

- `manifest.json` - Extension configuration
- `background.js` - Background service worker
- `popup.html/popup.js/popup.css` - Extension popup UI
- `content.js` - Script injected into web pages
- `heatmap.css` - Styles for the heatmap overlay

## Exporting Data from Google Analytics

1. Go to Google Analytics
2. Navigate to Events report
3. Filter for scroll events (scroll_to_10, scroll_to_25, etc.)
4. Export as CSV
5. Upload the CSV to this extension

## License

MIT