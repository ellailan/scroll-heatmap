// Content Script - Injects heat map overlay into web pages

let heatMapOverlay = null;
let gradientOverlay = null;
let legendPanel = null;
let closeButton = null;
let isHeatMapVisible = false;
let currentScrollData = null;

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'toggleHeatMap') {
    if (request.visible) {
      showHeatMap(request.data);
    } else {
      hideHeatMap();
    }
    sendResponse({ success: true });
  }
  
  if (request.action === 'updateHeatMap') {
    if (isHeatMapVisible) {
      showHeatMap(request.data);
    }
    sendResponse({ success: true });
  }
  
  return true;
});

// Create and show the heat map overlay
function showHeatMap(scrollData) {
  // Remove existing overlay if any
  hideHeatMap();
  
  currentScrollData = scrollData;
  
  // Get the full page height
  const pageHeight = Math.max(
    document.documentElement.scrollHeight,
    document.body.scrollHeight,
    document.documentElement.offsetHeight,
    document.body.offsetHeight,
    document.documentElement.clientHeight
  );
  
  // Create the main overlay container (fixed to viewport)
  heatMapOverlay = document.createElement('div');
  heatMapOverlay.id = 'scroll-heatmap-overlay';
  heatMapOverlay.className = 'scroll-heatmap-fullscreen';
  
  // Create the gradient overlay that will show the heatmap
  gradientOverlay = document.createElement('div');
  gradientOverlay.className = 'scroll-heatmap-gradient-overlay';
  gradientOverlay.style.height = pageHeight + 'px';
  
  // Build the gradient based on scroll data
  if (scrollData && scrollData.scrollDepths && Object.keys(scrollData.scrollDepths).length > 0) {
    gradientOverlay.style.background = buildGradient(scrollData);
  } else {
    // Default gradient if no data
    gradientOverlay.style.background = 'linear-gradient(to bottom, rgba(255, 0, 0, 0.3), rgba(255, 165, 0, 0.3), rgba(255, 255, 0, 0.3), rgba(0, 255, 0, 0.3), rgba(0, 255, 255, 0.3), rgba(0, 0, 255, 0.3))';
  }
  
  // Position the gradient based on current scroll
  updateGradientPosition();
  
  // Create the legend panel on the left
  const legend = document.createElement('div');
  legend.className = 'scroll-heatmap-legend';
  
  // Header with title and controls
  const legendHeader = document.createElement('div');
  legendHeader.className = 'scroll-heatmap-legend-header';
  
  // Legend title
  const legendTitle = document.createElement('div');
  legendTitle.className = 'scroll-heatmap-legend-title';
  legendTitle.textContent = 'Scroll Depth';
  legendHeader.appendChild(legendTitle);
  
  // Minimize button
  const minimizeBtn = document.createElement('button');
  minimizeBtn.className = 'scroll-heatmap-minimize-btn';
  minimizeBtn.textContent = '−';
  minimizeBtn.title = 'Minimize';
  minimizeBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    legend.classList.toggle('minimized');
    minimizeBtn.textContent = legend.classList.contains('minimized') ? '+' : '−';
  });
  legendHeader.appendChild(minimizeBtn);
  
  legend.appendChild(legendHeader);
  
  // Make legend draggable
  let isDragging = false;
  let dragOffset = { x: 0, y: 0 };
  
  const handleMouseDown = (e) => {
    if (e.target === minimizeBtn) return;
    e.preventDefault();
    e.stopPropagation();
    isDragging = true;
    legend.classList.add('dragging');
    const rect = legend.getBoundingClientRect();
    dragOffset.x = e.clientX - rect.left;
    dragOffset.y = e.clientY - rect.top;
    // Set initial position
    legend.style.left = rect.left + 'px';
    legend.style.top = rect.top + 'px';
  };
  
  const handleMouseMove = (e) => {
    if (!isDragging) return;
    e.preventDefault();
    const x = Math.max(0, Math.min(window.innerWidth - legend.offsetWidth, e.clientX - dragOffset.x));
    const y = Math.max(0, Math.min(window.innerHeight - legend.offsetHeight, e.clientY - dragOffset.y));
    legend.style.left = x + 'px';
    legend.style.top = y + 'px';
  };
  
  const handleMouseUp = () => {
    if (isDragging) {
      isDragging = false;
      legend.classList.remove('dragging');
      legend.classList.add('has-been-dragged');
    }
  };
  
  legendHeader.addEventListener('mousedown', handleMouseDown);
  window.addEventListener('mousemove', handleMouseMove);
  window.addEventListener('mouseup', handleMouseUp);
  
  // Store references for cleanup
  legend._dragHandlers = { handleMouseDown, handleMouseMove, handleMouseUp };
  
  // Legend content wrapper (for minimizing)
  const legendContent = document.createElement('div');
  legendContent.className = 'scroll-heatmap-legend-content';
  
  // Legend items - use the same scroll points as the page gradient for consistency
  // Sorted from lowest to highest (10% at top)
  const legendPoints = [10, 25, 50, 75, 100];
  
  const maxUsers = scrollData && scrollData.totalUsers ? scrollData.totalUsers : 1;
  
  legendPoints.forEach(percent => {
    const item = document.createElement('div');
    item.className = 'scroll-heatmap-legend-item';
    
    const colorBox = document.createElement('div');
    colorBox.className = 'scroll-heatmap-legend-color';
    // Get users who scrolled to this percentage - same logic as page gradient
    const users = scrollData && scrollData.scrollDepths ? 
      (scrollData.scrollDepths[String(percent)] || 0) : 0;
    const ratio = users / maxUsers;
    // Use the same color as the page gradient (but fully opaque for visibility)
    colorBox.style.backgroundColor = getHeatColor(ratio, 1.0);
    
    const label = document.createElement('span');
    label.className = 'scroll-heatmap-legend-label';
    label.textContent = `${percent}%`;
    
    const countLabel = document.createElement('span');
    countLabel.className = 'scroll-heatmap-legend-count';
    if (scrollData && scrollData.scrollDepths) {
      const count = scrollData.scrollDepths[String(percent)] || 0;
      const percentage = Math.round((count / maxUsers) * 100);
      countLabel.textContent = `${count} (${percentage}%)`;
    }
    
    item.appendChild(colorBox);
    item.appendChild(label);
    item.appendChild(countLabel);
    legendContent.appendChild(item);
  });
  
  // Add color gradient bar showing full range
  const gradientBarContainer = document.createElement('div');
  gradientBarContainer.className = 'scroll-heatmap-gradient-bar-container';
  
  const gradientBarLabel = document.createElement('div');
  gradientBarLabel.className = 'scroll-heatmap-gradient-bar-label';
  gradientBarLabel.textContent = 'Color Scale';
  gradientBarContainer.appendChild(gradientBarLabel);
  
  const gradientBarWrapper = document.createElement('div');
  gradientBarWrapper.className = 'scroll-heatmap-gradient-bar-wrapper';
  
  const gradientBar = document.createElement('div');
  gradientBar.className = 'scroll-heatmap-gradient-bar';
  // Build full gradient: Red (bad/few users) on left to Green (good/many users) on right
  gradientBar.style.background = 'linear-gradient(to right, rgba(255, 0, 0, 1), rgba(255, 165, 0, 1), rgba(255, 255, 0, 1), rgba(144, 238, 144, 1), rgba(0, 200, 0, 1))';
  
  const gradientLabels = document.createElement('div');
  gradientLabels.className = 'scroll-heatmap-gradient-labels';
  gradientLabels.innerHTML = '<span>Few</span><span>Many</span>';
  
  gradientBarWrapper.appendChild(gradientBar);
  gradientBarWrapper.appendChild(gradientLabels);
  gradientBarContainer.appendChild(gradientBarWrapper);
  legendContent.appendChild(gradientBarContainer);
  
  // Add legend content to legend
  legend.appendChild(legendContent);
  
  // Export button
  const exportBtn = document.createElement('button');
  exportBtn.className = 'scroll-heatmap-export-btn';
  exportBtn.textContent = '📤 Export';
  exportBtn.title = 'Export as image for presentations';
  exportBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    exportAsImage();
  });
  legendContent.appendChild(exportBtn);
  
  // Close button
  const closeBtn = document.createElement('button');
  closeBtn.className = 'scroll-heatmap-close';
  closeBtn.textContent = '×';
  closeBtn.title = 'Close Heatmap';
  closeBtn.addEventListener('click', () => {
    hideHeatMap();
    // Notify the popup to update toggle state
    chrome.storage.local.set({ heatMapEnabled: false });
  });
  
  // Add percentage marker lines on the page (add to gradient overlay so they scroll together)
  const markerPoints = [10, 25, 50, 75, 100];
  
  markerPoints.forEach(percent => {
    const marker = document.createElement('div');
    marker.className = 'scroll-heatmap-marker';
    marker.style.top = `${percent}%`;
    
    // Get the data for this percentage
    const users = scrollData && scrollData.scrollDepths ? 
      (scrollData.scrollDepths[String(percent)] || 0) : 0;
    const ratio = users / maxUsers;
    const color = getHeatColor(ratio, 1.0);
    
    // Create the dotted line
    const line = document.createElement('div');
    line.className = 'scroll-heatmap-marker-line';
    line.style.borderTopColor = color;
    marker.appendChild(line);
    
    // Create the label
    const label = document.createElement('div');
    label.className = 'scroll-heatmap-marker-label';
    label.style.backgroundColor = color;
    
    // Use dark text for yellow/orange colors (ratio between 0.25 and 0.75)
    if (ratio >= 0.25 && ratio <= 0.75) {
      label.classList.add('dark-text');
    } else {
      label.classList.add('light-text');
    }
    
    // Create row for percent and count
    const row = document.createElement('div');
    row.className = 'scroll-heatmap-marker-row';
    
    const percentText = document.createElement('span');
    percentText.className = 'scroll-heatmap-marker-percent';
    percentText.textContent = `${percent}%`;
    row.appendChild(percentText);
    
    const countText = document.createElement('span');
    countText.className = 'scroll-heatmap-marker-count';
    if (scrollData && scrollData.scrollDepths) {
      const count = scrollData.scrollDepths[String(percent)] || 0;
      const percentage = Math.round((count / maxUsers) * 100);
      countText.textContent = `${count} (${percentage}%)`;
    }
    row.appendChild(countText);
    label.appendChild(row);
    
    // Add audience loss explanation with raw count and comparative context
    const explanationText = document.createElement('span');
    explanationText.className = 'scroll-heatmap-marker-explanation';
    if (scrollData && scrollData.scrollDepths) {
      const count = scrollData.scrollDepths[String(percent)] || 0;
      const percentage = Math.round((count / maxUsers) * 100);
      
      // Build message: raw count + comparative context
      let message = '';
      if (percentage >= 75) {
        message = `${count} users reached here - Strong engagement`;
      } else if (percentage >= 50) {
        message = `${count} users made it this far - Good engagement`;
      } else if (percentage >= 25) {
        message = `${count} users reached here - Low engagement`;
      } else {
        message = `${count} users made it this far - Few viewers reached this point`;
      }
      explanationText.textContent = message;
    }
    label.appendChild(explanationText);
    
    marker.appendChild(label);
    gradientOverlay.appendChild(marker);
  });
  
  // Store references
  legendPanel = legend;
  closeButton = closeBtn;
  
  // Assemble the overlay - legend and close button go directly on body for proper event handling
  heatMapOverlay.appendChild(gradientOverlay);
  
  // Add to page
  document.body.appendChild(heatMapOverlay);
  document.body.appendChild(legend);
  document.body.appendChild(closeBtn);
  isHeatMapVisible = true;
  
  // Animate in
  requestAnimationFrame(() => {
    heatMapOverlay.classList.add('visible');
  });
  
  // Listen for scroll events to update gradient position
  window.addEventListener('scroll', updateGradientPosition);
  window.addEventListener('resize', handleResize);
}

// Update gradient position based on scroll
function updateGradientPosition() {
  if (gradientOverlay) {
    const scrollY = window.scrollY || window.pageYOffset;
    gradientOverlay.style.transform = `translateY(-${scrollY}px)`;
  }
}

// Handle window resize
function handleResize() {
  if (gradientOverlay) {
    const pageHeight = Math.max(
      document.documentElement.scrollHeight,
      document.body.scrollHeight,
      document.documentElement.offsetHeight,
      document.body.offsetHeight,
      document.documentElement.clientHeight
    );
    gradientOverlay.style.height = pageHeight + 'px';
  }
}

// Build gradient CSS based on scroll data
function buildGradient(scrollData) {
  const depths = scrollData.scrollDepths;
  const maxUsers = scrollData.totalUsers || 1;
  
  // Create gradient stops at fixed intervals
  // Each stop's color represents the percentage of users who scrolled to that point
  const gradientStops = [];
  
  // Define the scroll depth points we want to show (in order from top to bottom of page)
  const scrollPoints = [0, 10, 25, 50, 75, 90, 100];
  
  scrollPoints.forEach(scrollPercent => {
    // Get the number of users who scrolled to this percentage
    // For 0%, assume all users (they start at the top)
    let users;
    if (scrollPercent === 0) {
      users = maxUsers;
    } else {
      // Use string key
      users = depths[String(scrollPercent)] || 0;
    }
    
    const ratio = users / maxUsers;
    const color = getHeatColor(ratio, 0.35);
    
    // The gradient position corresponds to the scroll percentage
    // 0% scroll = top of page, 100% scroll = bottom of page
    gradientStops.push(`${color} ${scrollPercent}%`);
  });
  
  return `linear-gradient(to bottom, ${gradientStops.join(', ')})`;
}

// Get color based on user ratio (0 to 1)
// High ratio (many users) = Green (good)
// Low ratio (few users) = Red (bad)
function getHeatColor(ratio, alpha = 0.8) {
  // Clamp ratio between 0 and 1
  ratio = Math.max(0, Math.min(1, ratio));
  
  let r, g, b;
  
  // Color scale:
  // ratio 1.0 = Green (good - many users)
  // ratio 0.75 = Light Green
  // ratio 0.5 = Yellow
  // ratio 0.25 = Orange
  // ratio 0.0 = Red (bad - few users)
  
  if (ratio >= 0.75) {
    // Light Green to Green (ratio: 0.75 to 1.0)
    const t = (ratio - 0.75) / 0.25;
    r = 0;
    g = Math.round(200 + 55 * t); // 200 to 255
    b = 0;
  } else if (ratio >= 0.5) {
    // Yellow to Light Green (ratio: 0.5 to 0.75)
    const t = (ratio - 0.5) / 0.25;
    r = Math.round(255 * (1 - t)); // 255 to 0
    g = Math.round(200 + 55 * t); // 200 to 255
    b = 0;
  } else if (ratio >= 0.25) {
    // Orange to Yellow (ratio: 0.25 to 0.5)
    const t = (ratio - 0.25) / 0.25;
    r = 255;
    g = Math.round(165 + 90 * t); // 165 to 255
    b = 0;
  } else {
    // Red to Orange (ratio: 0 to 0.25)
    const t = ratio / 0.25;
    r = 255;
    g = Math.round(165 * t); // 0 to 165
    b = 0;
  }
  
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// Hide and remove the heat map overlay
function hideHeatMap() {
  // Remove event listeners
  window.removeEventListener('scroll', updateGradientPosition);
  window.removeEventListener('resize', handleResize);
  
  // Remove drag event listeners from legend
  if (legendPanel && legendPanel._dragHandlers) {
    const { handleMouseDown, handleMouseMove, handleMouseUp } = legendPanel._dragHandlers;
    legendPanel.querySelector('.scroll-heatmap-legend-header')?.removeEventListener('mousedown', handleMouseDown);
    window.removeEventListener('mousemove', handleMouseMove);
    window.removeEventListener('mouseup', handleMouseUp);
  }
  
  // Remove legend panel
  if (legendPanel && legendPanel.parentNode) {
    legendPanel.parentNode.removeChild(legendPanel);
  }
  legendPanel = null;
  
  // Remove close button
  if (closeButton && closeButton.parentNode) {
    closeButton.parentNode.removeChild(closeButton);
  }
  closeButton = null;
  
  // Remove overlay
  if (heatMapOverlay) {
    heatMapOverlay.classList.remove('visible');
    setTimeout(() => {
      if (heatMapOverlay && heatMapOverlay.parentNode) {
        heatMapOverlay.parentNode.removeChild(heatMapOverlay);
      }
      heatMapOverlay = null;
      gradientOverlay = null;
    }, 300);
  }
  isHeatMapVisible = false;
  currentScrollData = null;
}

// Helper function to draw rounded rectangle (polyfill for roundRect)
function drawRoundedRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

// Helper function to wrap text into lines
function wrapText(ctx, text, maxWidth) {
  const words = text.split(' ');
  const lines = [];
  let currentLine = '';
  
  words.forEach(word => {
    const testLine = currentLine + word + ' ';
    const metrics = ctx.measureText(testLine);
    if (metrics.width > maxWidth && currentLine !== '') {
      lines.push(currentLine.trim());
      currentLine = word + ' ';
    } else {
      currentLine = testLine;
    }
  });
  
  if (currentLine.trim()) {
    lines.push(currentLine.trim());
  }
  
  return lines;
}

// Helper function to find optimal font size that fits text in given width
function getOptimalFontSize(ctx, text, maxWidth, maxFontSize, minFontSize = 10) {
  let fontSize = maxFontSize;
  ctx.font = `bold ${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
  
  while (ctx.measureText(text).width > maxWidth && fontSize > minFontSize) {
    fontSize--;
    ctx.font = `bold ${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
  }
  
  return fontSize;
}

// Export the heatmap as an image with summary card
async function exportAsImage() {
  if (!currentScrollData || !heatMapOverlay) {
    console.error('No heatmap data to export');
    alert('No heatmap data to export. Please load data first.');
    return;
  }
  
  // Check if html2canvas is available
  if (typeof html2canvas === 'undefined') {
    console.error('html2canvas library not loaded');
    alert('Export library not loaded. Please refresh the page and try again.');
    return;
  }
  
  // Show loading indicator
  const loadingIndicator = document.createElement('div');
  loadingIndicator.className = 'scroll-heatmap-export-loading';
  loadingIndicator.textContent = 'Generating export...';
  document.body.appendChild(loadingIndicator);
  
  try {
    // Temporarily hide legend and close button for clean capture
    if (legendPanel) legendPanel.style.display = 'none';
    if (closeButton) closeButton.style.display = 'none';
    
    // Get the actual content dimensions (exclude white space)
    const contentWidth = Math.max(
      document.body.scrollWidth,
      document.documentElement.scrollWidth,
      document.body.offsetWidth,
      document.documentElement.offsetWidth
    );
    
    const contentHeight = Math.max(
      document.body.scrollHeight,
      document.documentElement.scrollHeight,
      document.body.offsetHeight,
      document.documentElement.offsetHeight
    );
    
    // Use html2canvas to capture the page
    const pageCanvas = await html2canvas(document.body, {
      logging: false,
      useCORS: true,
      allowTaint: true,
      scrollY: 0,
      scrollX: 0,
      width: contentWidth,
      height: contentHeight,
      windowWidth: contentWidth,
      windowHeight: contentHeight,
      scale: 1 // Normal resolution for smaller file size
    });
    
    // Restore legend and close button
    if (legendPanel) legendPanel.style.display = '';
    if (closeButton) closeButton.style.display = '';
    
    // Calculate dimensions
    const pageWidth = pageCanvas.width;
    const pageHeight = pageCanvas.height;
    const maxUsers = currentScrollData.totalUsers || 1;
    
    // Analytics card should be at least 1/3 of total height
    const cardPadding = Math.floor(pageHeight * 0.02); // 2% of page height
    const cardHeight = Math.floor(pageHeight * 0.5); // Card is 50% of page height (1/3 of total)
    const cardWidth = pageWidth - (cardPadding * 2);
    const cardX = cardPadding;
    const cardY = cardPadding;
    const padding = Math.floor(cardHeight * 0.08); // 8% of card height
    
    // Font sizes relative to image height
    const titleFontSize = Math.floor(cardHeight * 0.08); // 8% of card height
    const subtitleFontSize = Math.floor(cardHeight * 0.05); // 5% of card height
    const barLabelFontSize = Math.floor(cardHeight * 0.05); // 5% of card height
    const barCountFontSize = Math.floor(cardHeight * 0.045); // 4.5% of card height
    const insightFontSize = Math.floor(cardHeight * 0.045); // 4.5% of card height
    const lineLabelFontSize = Math.floor(pageHeight * 0.04); // 4% of page height for line labels
    
    // Bar chart dimensions relative to card
    const barHeight = Math.floor(cardHeight * 0.06);
    const barSpacing = Math.floor(cardHeight * 0.08);
    const barMaxWidth = Math.floor(cardWidth * 0.5);
    
    // Recalculate total height with actual card height
    const actualTotalHeight = cardHeight + pageHeight + cardPadding;
    const canvas = document.createElement('canvas');
    canvas.width = pageWidth;
    canvas.height = actualTotalHeight;
    const ctx = canvas.getContext('2d');
    
    // Fill background
    ctx.fillStyle = '#f5f5f5';
    ctx.fillRect(0, 0, pageWidth, actualTotalHeight);
    
    // Draw analytics card at top
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.15)';
    ctx.shadowBlur = 20;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 4;
    drawRoundedRect(ctx, cardX, cardY, cardWidth, cardHeight, 16);
    ctx.fill();
    ctx.shadowColor = 'transparent';
    
    // Card border
    ctx.strokeStyle = '#e0e0e0';
    ctx.lineWidth = 2;
    drawRoundedRect(ctx, cardX, cardY, cardWidth, cardHeight, 16);
    ctx.stroke();
    
    // Title - dynamically size font to fit
    ctx.fillStyle = '#1a1a1a';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    
    const titleText = '📊 Scroll Depth Analysis';
    const maxTitleWidth = cardWidth - padding * 2;
    const actualTitleFontSize = getOptimalFontSize(ctx, titleText, maxTitleWidth, titleFontSize, 12);
    ctx.font = `bold ${actualTitleFontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
    ctx.fillText(titleText, cardX + padding, cardY + padding + actualTitleFontSize);
    
    // URL and sessions on same line
    const headerLineY = cardY + padding + actualTitleFontSize + subtitleFontSize + 15;
    
    // Calculate available width for URL (leave room for sessions on right)
    const sessionsText = `Sessions: ${currentScrollData.totalUsers}`;
    ctx.font = `${subtitleFontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
    const sessionsWidth = ctx.measureText(sessionsText).width + 20;
    
    // URL on left - dynamically size to fit remaining space
    ctx.fillStyle = '#666';
    ctx.textAlign = 'left';
    const url = window.location.hostname || 'Page';
    const maxUrlWidth = cardWidth - padding * 2 - sessionsWidth;
    const actualUrlFontSize = getOptimalFontSize(ctx, url, maxUrlWidth, subtitleFontSize, 10);
    ctx.font = `${actualUrlFontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
    ctx.fillText(url, cardX + padding, headerLineY);
    
    // Sessions on right side
    ctx.textAlign = 'right';
    ctx.fillStyle = '#333';
    ctx.font = `${subtitleFontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
    ctx.fillText(sessionsText, cardX + cardWidth - padding, headerLineY);
    
    // Divider line
    ctx.strokeStyle = '#e0e0e0';
    ctx.lineWidth = 2;
    const dividerY = cardY + padding + titleFontSize + subtitleFontSize + 30;
    ctx.beginPath();
    ctx.moveTo(cardX + padding, dividerY);
    ctx.lineTo(cardX + cardWidth - padding, dividerY);
    ctx.stroke();
    
    // Bar chart - centered and properly sized
    const barStartY = dividerY + 30;
    const legendPoints = [10, 25, 50, 75, 100];
    
    // Calculate bar width to fit within card with proper spacing
    const labelWidth = barLabelFontSize * 4; // Space for "100%"
    const countWidth = barCountFontSize * 8; // Space for "999 (100%)"
    const barGap = 20; // Gap between elements
    const availableBarWidth = cardWidth - padding * 2 - labelWidth - countWidth - barGap * 2;
    const actualBarMaxWidth = Math.max(100, Math.min(barMaxWidth, availableBarWidth));
    
    // Center the entire bar chart
    const totalChartWidth = labelWidth + actualBarMaxWidth + countWidth + barGap * 2;
    const chartStartX = cardX + (cardWidth - totalChartWidth) / 2;
    
    legendPoints.forEach((percent, index) => {
      const count = currentScrollData.scrollDepths[String(percent)] || 0;
      const ratio = count / maxUsers;
      const barWidth = Math.max(barHeight, ratio * actualBarMaxWidth);
      const y = barStartY + index * barSpacing;
      
      // Label (centered vertically)
      ctx.fillStyle = '#333';
      ctx.font = `bold ${barLabelFontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${percent}%`, chartStartX + labelWidth - 10, y + barHeight / 2);
      
      // Bar background
      ctx.fillStyle = '#f0f0f0';
      drawRoundedRect(ctx, chartStartX + labelWidth + barGap, y, actualBarMaxWidth, barHeight, 6);
      ctx.fill();
      
      // Bar fill with heat color
      ctx.fillStyle = getHeatColor(ratio, 1.0);
      drawRoundedRect(ctx, chartStartX + labelWidth + barGap, y, barWidth, barHeight, 6);
      ctx.fill();
      
      // Count and percentage (centered vertically)
      ctx.textAlign = 'left';
      ctx.fillStyle = '#555';
      ctx.font = `${barCountFontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
      const pctOfTotal = Math.round((count / maxUsers) * 100);
      ctx.fillText(`${count} (${pctOfTotal}%)`, chartStartX + labelWidth + actualBarMaxWidth + barGap * 2, y + barHeight / 2);
    });
    
    // Reset text baseline
    ctx.textBaseline = 'alphabetic';
    
    // Key insight - centered and word wrapped
    ctx.textAlign = 'left';
    const insightY = barStartY + 5 * barSpacing + barHeight + 10;
    ctx.fillStyle = '#1a1a1a';
    ctx.font = `bold ${insightFontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
    
    // Generate dynamic insight based on data patterns
    const insight = generateInsight(currentScrollData, maxUsers);
    
    // Word wrap the insight text to fit within card
    ctx.font = `${insightFontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
    ctx.fillStyle = '#444';
    
    const maxInsightWidth = cardWidth - padding * 2;
    const insightLines = wrapText(ctx, '💡 ' + insight, maxInsightWidth);
    let lineY = insightY;
    
    insightLines.forEach(line => {
      ctx.fillText(line, cardX + padding, lineY);
      lineY += insightFontSize + 6;
    });
    
    // Draw the page screenshot below the card
    ctx.drawImage(pageCanvas, 0, cardHeight + cardPadding);
    
    // Now draw heatmap overlay on the page portion
    const pageStartY = cardHeight + cardPadding;
    
    // Draw the heatmap gradient overlay
    const scrollPoints = [0, 10, 25, 50, 75, 90, 100];
    const gradient = ctx.createLinearGradient(0, pageStartY, 0, pageStartY + pageHeight);
    
    scrollPoints.forEach(scrollPercent => {
      let users;
      if (scrollPercent === 0) {
        users = maxUsers;
      } else {
        users = currentScrollData.scrollDepths[String(scrollPercent)] || 0;
      }
      
      const ratio = users / maxUsers;
      const color = getHeatColor(ratio, 0.35);
      gradient.addColorStop(scrollPercent / 100, color);
    });
    
    ctx.fillStyle = gradient;
    ctx.fillRect(0, pageStartY, pageWidth, pageHeight);
    
    // Draw percentage marker lines with labels - using relative font size
    const markerPoints = [10, 25, 50, 75, 100];
    const labelHeight = Math.floor(pageHeight * 0.05); // 5% of page height
    const labelPadding = Math.floor(pageHeight * 0.02); // 2% of page height
    
    markerPoints.forEach(percent => {
      const y = pageStartY + (percent / 100) * pageHeight;
      const users = currentScrollData.scrollDepths[String(percent)] || 0;
      const ratio = users / maxUsers;
      const color = getHeatColor(ratio, 1.0);
      
      // Draw dashed line - thickness relative to page height
      ctx.strokeStyle = color;
      ctx.lineWidth = Math.floor(pageHeight * 0.005); // 0.5% of page height
      ctx.setLineDash([Math.floor(pageHeight * 0.015), Math.floor(pageHeight * 0.008)]);
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(pageWidth, y);
      ctx.stroke();
      ctx.setLineDash([]);
      
      // Draw label on right side - using relative font size
      const labelText = `${percent}% - ${users} users`;
      ctx.font = `bold ${lineLabelFontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
      const textMetrics = ctx.measureText(labelText);
      const labelWidth = textMetrics.width + labelPadding * 2;
      
      // Ensure label stays within page bounds
      let labelX = pageWidth - labelWidth - labelPadding;
      let labelY = y - labelHeight / 2;
      
      // Keep label from going off top
      if (labelY < pageStartY) {
        labelY = pageStartY + 5;
      }
      // Keep label from going off bottom
      if (labelY + labelHeight > pageStartY + pageHeight) {
        labelY = pageStartY + pageHeight - labelHeight - 5;
      }
      
      // Label background with shadow
      ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
      ctx.shadowBlur = 10;
      ctx.shadowOffsetX = 2;
      ctx.shadowOffsetY = 2;
      ctx.fillStyle = color;
      drawRoundedRect(ctx, labelX, labelY, labelWidth, labelHeight, Math.floor(pageHeight * 0.01));
      ctx.fill();
      ctx.shadowColor = 'transparent';
      
      // Label text
      ctx.fillStyle = (ratio >= 0.25 && ratio <= 0.75) ? '#1a1a1a' : '#ffffff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(labelText, labelX + labelWidth / 2, labelY + labelHeight / 2);
    });
    
    // Download the image
    const link = document.createElement('a');
    const date = new Date().toISOString().split('T')[0];
    link.download = `scroll-analysis_${url}_${date}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
    
  } catch (error) {
    console.error('Export failed:', error);
    alert('Failed to export image. Please try again.');
  } finally {
    // Remove loading indicator
    if (loadingIndicator.parentNode) {
      loadingIndicator.parentNode.removeChild(loadingIndicator);
    }
  }
}

// Generate dynamic insight based on scroll data
function generateInsight(data, maxUsers) {
  const depths = data.scrollDepths || {};
  
  // Get all available percentage points
  const points = [10, 25, 50, 75, 90, 100].map(p => ({
    percent: p,
    count: depths[String(p)] || 0
  }));
  
  // Find the biggest drop-off
  let biggestDrop = { from: 0, to: 0, dropPercent: 0 };
  for (let i = 1; i < points.length; i++) {
    const drop = points[i-1].count - points[i].count;
    const dropPercent = points[i-1].count > 0 ? (drop / points[i-1].count) * 100 : 0;
    if (drop > 0 && dropPercent > biggestDrop.dropPercent) {
      biggestDrop = {
        from: points[i-1].percent,
        to: points[i].percent,
        dropPercent: dropPercent,
        dropCount: drop
      };
    }
  }
  
  // Calculate engagement level
  const bottomReach = depths['100'] || 0;
  const bottomPercent = Math.round((bottomReach / maxUsers) * 100);
  
  // Build insight message
  let insight = '';
  
  if (biggestDrop.dropPercent > 30) {
    insight = `Major drop-off: ${Math.round(biggestDrop.dropPercent)}% of users left between ${biggestDrop.from}% and ${biggestDrop.to}% scroll. Consider moving key content higher.`;
  } else if (bottomPercent >= 75) {
    insight = `Strong engagement: ${bottomPercent}% of users reached the bottom. Content is performing well.`;
  } else if (bottomPercent >= 50) {
    insight = `Good engagement: ${bottomPercent}% scrolled to the end. Consider testing content layout below 50%.`;
  } else if (bottomPercent >= 25) {
    insight = `Moderate engagement: Only ${bottomPercent}% reached the bottom. Key content should be above 50% scroll.`;
  } else {
    insight = `Low engagement: Only ${bottomPercent}% scrolled to the bottom. Most users don't scroll past 25%.`;
  }
  
  return insight;
}

// Check initial state on load
chrome.storage.local.get(['heatMapEnabled', 'scrollData'], (result) => {
  if (result.heatMapEnabled && result.scrollData) {
    showHeatMap(result.scrollData);
  }
});
