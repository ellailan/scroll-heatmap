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

// Check initial state on load
chrome.storage.local.get(['heatMapEnabled', 'scrollData'], (result) => {
  if (result.heatMapEnabled && result.scrollData) {
    showHeatMap(result.scrollData);
  }
});