# Scroll Heat Map Extension

A Chrome extension that visualizes scroll depth data as a heatmap overlay on any website.

## Features

- Upload CSV files with scroll depth data from Google Analytics
- Visual heatmap overlay showing user engagement at different scroll depths
- Color-coded gradient: **Green = Good** (many users), **Red = Bad** (few users)
- **Export as image** - Generate presentation-ready PNG for slide decks

## Installation

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" in the top right corner
3. Click "Load unpacked" and select the `scroll-heatmap-extension` folder

## Usage

1. Click the extension icon in your Chrome toolbar
2. Click "Upload CSV File" and select your CSV file
3. Toggle "Show Heat Map" to display the heatmap on the current page
4. Click "📤 Export" to download a PNG image for presentations

## CSV Format

The extension expects a CSV file exported from Google Analytics with:
- `Event name` - values like `scroll_to_10`, `scroll_to_25`, `scroll_to_50`, `scroll_to_75`, `scroll_to_100`
- `Event count` - the number of events at that scroll depth

## Exporting Data from Google Analytics

1. Go to Google Analytics → Events report
2. Filter for scroll events (scroll_to_10, scroll_to_25, etc.)
3. Export as CSV
4. Upload the CSV to this extension