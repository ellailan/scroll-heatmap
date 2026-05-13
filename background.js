// Background Service Worker for Scroll Heat Map Extension
// Simplified version - no Google authentication required

// Listen for messages from popup or content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getScrollData') {
    // Get stored CSV data
    getScrollData(sendResponse);
    return true;
  }
  
  return true;
});

// Get scroll data from storage
async function getScrollData(sendResponse) {
  try {
    const result = await chrome.storage.local.get('scrollData');
    sendResponse({ 
      success: true, 
      data: result.scrollData || null 
    });
  } catch (error) {
    console.error('Get scroll data error:', error);
    sendResponse({ success: false, error: error.message });
  }
}

// Listen for installation
chrome.runtime.onInstalled.addListener(() => {
  console.log('Scroll Heat Map extension installed');
});