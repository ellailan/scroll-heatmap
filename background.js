// Background Service Worker for Scroll Heat Map Extension
// Simplified version - no Google authentication required

// Listen for messages from popup or content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getScrollData') {
    // Get stored CSV data
    getScrollData(sendResponse);
    return true;
  }
  
  if (request.action === 'fetchImage') {
    // Fetch an image URL and return as data URL (bypasses CORS)
    fetchImageAsDataUrl(request.url)
      .then(dataUrl => sendResponse({ success: true, dataUrl }))
      .catch(error => sendResponse({ success: false, error: error.message }));
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

// Fetch an image and return as base64 data URL (bypasses CORS restrictions)
async function fetchImageAsDataUrl(url) {
  const response = await fetch(url);
  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// Listen for installation
chrome.runtime.onInstalled.addListener(() => {
  console.log('Scroll Heat Map extension installed');
});
