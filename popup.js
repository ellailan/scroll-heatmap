// Popup Script - Handles CSV upload and heatmap control

document.addEventListener('DOMContentLoaded', () => {
  // DOM Elements
  const uploadBtn = document.getElementById('upload-btn');
  const csvInput = document.getElementById('csv-input');
  const fileNameDisplay = document.getElementById('file-name');
  const heatMapToggle = document.getElementById('heatmap-toggle');
  const errorMessage = document.getElementById('error-message');
  const dataPreview = document.getElementById('data-preview');
  const scrollStats = document.getElementById('scroll-stats');
  const clearDataBtn = document.getElementById('clear-data-btn');
  
  // State
  let currentTab = null;
  let scrollData = null;
  
  // Initialize
  init();
  
  async function init() {
    // Get current tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    currentTab = tab;
    
    // Check if there's stored scroll data
    chrome.storage.local.get(['scrollData', 'heatMapEnabled'], (result) => {
      if (result.scrollData) {
        scrollData = result.scrollData;
        showDataPreview(scrollData);
        heatMapToggle.disabled = false;
        fileNameDisplay.textContent = 'Data loaded from previous session';
      }
      heatMapToggle.checked = result.heatMapEnabled || false;
    });
  }
  
  // Upload button click handler
  uploadBtn.addEventListener('click', () => {
    csvInput.click();
  });
  
  // File input change handler
  csvInput.addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (file) {
      fileNameDisplay.textContent = file.name;
      parseCSV(file);
    }
  });
  
  // Parse CSV file
  function parseCSV(file) {
    const reader = new FileReader();
    
    reader.onload = async (event) => {
      try {
        const csvContent = event.target.result;
        const data = parseCSVContent(csvContent);
        
        if (data && Object.keys(data.scrollDepths).length > 0) {
          scrollData = data;
          
          // Store the data
          chrome.storage.local.set({ scrollData: data });
          
          // Show preview
          showDataPreview(data);
          
          // Enable toggle
          heatMapToggle.disabled = false;
          hideError();
          
          // If heatmap is already visible, update the content script with new data
          if (heatMapToggle.checked && currentTab) {
            try {
              await chrome.tabs.sendMessage(currentTab.id, {
                action: 'updateHeatMap',
                visible: true,
                data: scrollData
              });
            } catch (e) {
              console.log('Could not update content script with new data:', e);
            }
          }
        } else {
          showError('No valid scroll data found in CSV. Make sure it contains "scroll_to_XX" events.');
        }
      } catch (error) {
        console.error('CSV parsing error:', error);
        showError('Failed to parse CSV file: ' + error.message);
      }
    };
    
    reader.onerror = () => {
      showError('Failed to read file');
    };
    
    reader.readAsText(file);
  }
  
  // Parse date string trying multiple formats
  function parseDate(str) {
    if (!str) return null;
    str = str.trim();
    
    // Skip obvious non-dates (numbers, event names, etc.)
    if (/^\d+$/.test(str) && str.length < 6) return null; // plain numbers like "10", "500"
    if (str.includes('scroll_to')) return null;
    
    // Try YYYYMMDD format (common in GA4 exports, e.g., "20250115")
    let match = str.match(/^(\d{4})(\d{2})(\d{2})$/);
    if (match) {
      const d = new Date(parseInt(match[1]), parseInt(match[2]) - 1, parseInt(match[3]));
      if (!isNaN(d.getTime())) return d;
    }
    
    // Try ISO format: 2025-01-15
    match = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) {
      const d = new Date(parseInt(match[1]), parseInt(match[2]) - 1, parseInt(match[3]));
      if (!isNaN(d.getTime())) return d;
    }
    
    // Try MM/DD/YYYY or MM-DD-YYYY
    match = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
    if (match) {
      const d = new Date(parseInt(match[3]), parseInt(match[1]) - 1, parseInt(match[2]));
      if (!isNaN(d.getTime())) return d;
    }
    
    // Try Mon DD, YYYY (e.g., "Jan 15, 2025" or "January 15, 2025")
    match = str.match(/^([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})/);
    if (match) {
      const d = new Date(match[1] + ' ' + match[2] + ', ' + match[3]);
      if (!isNaN(d.getTime())) return d;
    }
    
    // Try DD Mon YYYY (e.g., "15 Jan 2025")
    match = str.match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/);
    if (match) {
      const d = new Date(match[2] + ' ' + match[1] + ', ' + match[3]);
      if (!isNaN(d.getTime())) return d;
    }
    
    // Fallback: let Date constructor try (only for strings that look like they could be dates)
    if (str.length >= 6 && /[a-zA-Z]/.test(str) || /\d{4}/.test(str)) {
      const d = new Date(str);
      if (!isNaN(d.getTime()) && d.getFullYear() > 2000 && d.getFullYear() < 2100) return d;
    }
    
    return null;
  }
  
  // Parse CSV content and extract scroll data
  function parseCSVContent(content) {
    const lines = content.split('\n');
    const scrollDepths = {};
    let totalUsers = 0;
    let dateMin = null;
    let dateMax = null;
    
    // Find the header line
    let headerLine = -1;
    let eventNameCol = -1;
    let eventCountCol = -1;
    
    for (let i = 0; i < Math.min(5, lines.length); i++) {
      const line = lines[i].trim();
      if (line.toLowerCase().includes('event name') || line.toLowerCase().includes('eventname')) {
        const headers = parseCSVLine(line);
        headers.forEach((header, index) => {
          const h = header.toLowerCase().trim();
          if (h.includes('event name') || h === 'event name') {
            eventNameCol = index;
          }
          if (h.includes('event count') || h === 'event count') {
            eventCountCol = index;
          }
        });
        headerLine = i;
        break;
      }
    }
    
    // If no header found, try to detect columns from data
    if (headerLine === -1) {
      // Check first line for scroll events
      const firstLine = parseCSVLine(lines[0]);
      for (let i = 0; i < firstLine.length; i++) {
        if (firstLine[i].includes('scroll_to')) {
          eventNameCol = i;
          eventCountCol = i + 1;
          break;
        }
      }
    }
    
    // Process data lines
    const startLine = headerLine >= 0 ? headerLine + 1 : 0;
    
    // Sum up ALL rows with dates (ignore aggregate rows with empty dates)
    // Aggregate rows in some exports can be incorrect, so we calculate from raw data
    for (let i = startLine; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      const columns = parseCSVLine(line);
      
      // Check if this row has a date in the first column (not an aggregate row)
      const firstCol = columns[0] ? columns[0].trim() : '';
      const hasDate = firstCol !== '' && firstCol.length > 0;
      
      // Track date range - try to find dates in any column
      for (let c = 0; c < columns.length; c++) {
        const colVal = columns[c] ? columns[c].trim() : '';
        if (colVal && colVal.length > 0) {
          let dateVal = parseDate(colVal);
          if (dateVal) {
            if (dateMin === null || dateVal < dateMin) dateMin = dateVal;
            if (dateMax === null || dateVal > dateMax) dateMax = dateVal;
          }
        }
      }
      
      // Try to find scroll_to_XX pattern
      for (let j = 0; j < columns.length; j++) {
        const col = columns[j].trim();
        const scrollMatch = col.match(/scroll_to_(\d+)/i);
        
        if (scrollMatch) {
          const percent = parseInt(scrollMatch[1], 10);
          // Find the count - could be next column or specified column
          let count = 0;
          
          if (eventCountCol >= 0 && columns[eventCountCol]) {
            count = parseInt(columns[eventCountCol].trim(), 10) || 0;
          } else if (j + 1 < columns.length) {
            count = parseInt(columns[j + 1].trim(), 10) || 0;
          }
          
          if (count > 0) {
            const key = String(percent);
            
            // Only sum rows that have dates (individual data points)
            if (hasDate) {
              if (!scrollDepths[key]) {
                scrollDepths[key] = 0;
              }
              scrollDepths[key] += count;
            }
          }
        }
      }
    }
    
    // If no data was found with dates, fall back to aggregate rows
    if (Object.keys(scrollDepths).length === 0) {
      for (let i = startLine; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        
        const columns = parseCSVLine(line);
        const firstCol = columns[0] ? columns[0].trim() : '';
        const isAggregateRow = firstCol === '' || !firstCol;
        
        if (isAggregateRow) {
          for (let j = 0; j < columns.length; j++) {
            const col = columns[j].trim();
            const scrollMatch = col.match(/scroll_to_(\d+)/i);
            
            if (scrollMatch) {
              const percent = parseInt(scrollMatch[1], 10);
              let count = 0;
              
              if (eventCountCol >= 0 && columns[eventCountCol]) {
                count = parseInt(columns[eventCountCol].trim(), 10) || 0;
              } else if (j + 1 < columns.length) {
                count = parseInt(columns[j + 1].trim(), 10) || 0;
              }
              
              if (count > 0) {
                scrollDepths[String(percent)] = count;
              }
            }
          }
        }
      }
    }
    
    // Total users is the count at the lowest scroll depth (typically 10%)
    // This represents all users who started scrolling
    totalUsers = scrollDepths["10"] || Math.max(...Object.values(scrollDepths), 0);
    
    // Format date range
    let dateRange = '';
    if (dateMin && dateMax) {
      const fmtMin = dateMin.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      const fmtMax = dateMax.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      dateRange = (fmtMin === fmtMax) ? fmtMin : `${fmtMin} - ${fmtMax}`;
    }
    console.log('Scroll Heatmap: Date range detected:', dateRange, '(min:', dateMin, ', max:', dateMax, ')');
    
    return {
      totalUsers,
      scrollDepths,
      dateRange
    };
  }
  
  // Parse a single CSV line (handling quoted values)
  function parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    
    result.push(current.trim());
    return result;
  }
  
  // Show data preview
  function showDataPreview(data) {
    dataPreview.classList.remove('hidden');
    
    const depths = Object.keys(data.scrollDepths).sort((a, b) => a - b);
    let html = '<div class="stats-grid">';
    
    depths.forEach(depth => {
      const count = data.scrollDepths[depth];
      const percentage = data.totalUsers > 0 ? Math.round((count / data.totalUsers) * 100) : 0;
      html += `
        <div class="stat-item">
          <span class="stat-label">${depth}%</span>
          <span class="stat-value">${count} (${percentage}%)</span>
        </div>
      `;
    });
    
    html += '</div>';
    html += `<p class="total-users">Total sessions: ${data.totalUsers}</p>`;
    
    scrollStats.innerHTML = html;
  }
  
  // Show error message
  function showError(message) {
    errorMessage.textContent = message;
    errorMessage.classList.remove('hidden');
  }
  
  // Hide error message
  function hideError() {
    errorMessage.classList.add('hidden');
  }
  
  // Toggle heat map handler
  heatMapToggle.addEventListener('change', async () => {
    const isEnabled = heatMapToggle.checked;
    
    // Save state
    chrome.storage.local.set({ heatMapEnabled: isEnabled });
    
    try {
      if (isEnabled && scrollData) {
        // Send data to content script
        await chrome.tabs.sendMessage(currentTab.id, {
          action: 'toggleHeatMap',
          visible: true,
          data: scrollData
        });
      } else {
        // Hide heat map
        await chrome.tabs.sendMessage(currentTab.id, {
          action: 'toggleHeatMap',
          visible: false
        });
      }
    } catch (error) {
      console.error('Failed to send message to content script:', error);
      // Try to inject the content script if it's not loaded
      try {
        await chrome.scripting.executeScript({
          target: { tabId: currentTab.id },
          files: ['content.js']
        });
        await chrome.scripting.insertCSS({
          target: { tabId: currentTab.id },
          files: ['heatmap.css']
        });
        // Try again
        if (isEnabled && scrollData) {
          await chrome.tabs.sendMessage(currentTab.id, {
            action: 'toggleHeatMap',
            visible: true,
            data: scrollData
          });
        }
      } catch (injectError) {
        console.error('Failed to inject content script:', injectError);
        showError('Could not load heatmap on this page. Try refreshing the page.');
        heatMapToggle.checked = false;
      }
    }
  });
  
  // Clear data button handler
  clearDataBtn.addEventListener('click', async () => {
    chrome.storage.local.remove(['scrollData', 'heatMapEnabled']);
    scrollData = null;
    heatMapToggle.disabled = true;
    heatMapToggle.checked = false;
    dataPreview.classList.add('hidden');
    fileNameDisplay.textContent = '';
    
    // Hide heat map on current tab
    try {
      await chrome.tabs.sendMessage(currentTab.id, {
        action: 'toggleHeatMap',
        visible: false
      });
    } catch (error) {
      // Ignore errors if content script isn't loaded
      console.log('Could not send message to content script:', error);
    }
  });
});