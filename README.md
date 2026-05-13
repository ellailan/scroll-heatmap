# Scroll Heat Map Extension

A Chrome extension that visualizes scroll depth data as a heatmap overlay on any website.

## Features

- Upload CSV files with scroll depth data from Google Analytics
- Visual heatmap overlay showing user engagement at different scroll depths
- Color-coded gradient: **Green = Good** (many users), **Red = Bad** (few users)
- Dotted lines at each percentage mark (10%, 25%, 50%, 75%, 100%) with labels
- Draggable legend panel - drag the header to reposition
- Minimizable legend - click the "−" button to collapse
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
5. The heatmap overlay will appear with:
   - A gradient overlay showing engagement levels across the page
   - Dotted lines at each percentage mark with labels showing count and percentage
   - A legend panel on the left side

## Legend Panel

- **Draggable**: Click and drag the header ("Scroll Depth") to move the panel anywhere on screen
- **Minimizable**: Click the "−" button to collapse the panel; click "+" to expand
- **Color Scale**: Shows the full range of colors from Red (few users) to Green (many users)

## CSV Format

The extension expects a CSV file exported from Google Analytics with the following columns:
- `First session date` - Date of the session (can be empty for aggregate rows)
- `Event name` - containing values like `scroll_to_10`, `scroll_to_25`, `scroll_to_50`, `scroll_to_75`, `scroll_to_90`, `scroll_to_100`
- `Event count` - the number of events at that scroll depth

Example:
```csv
First session date,Event name,Event count
,scroll_to_25,49
,scroll_to_50,48
,scroll_to_75,48
,scroll_to_90,46
,scroll_to_10,26
"Apr 14, 2026",scroll_to_10,1
"Apr 14, 2026",scroll_to_25,1
...
```

**Note**: The extension sums individual date rows to calculate accurate totals. Aggregate rows (rows with empty dates) are used as a fallback if no dated rows are found.

## Heatmap Colors

- **Green** - High engagement (many users scrolled to this point)
- **Yellow/Orange** - Medium engagement
- **Red** - Low engagement (few users scrolled this far)

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
4. Export as CSV (Time series format works best)
5. Upload the CSV to this extension

## License

MIT