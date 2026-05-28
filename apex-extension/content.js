
console.log('[Apex] Content script loaded');

// Inject inject.js into page
const script = document.createElement('script');

script.src =
  chrome.runtime.getURL('inject.js');

script.onload = () => {
  script.remove();
};

(document.head || document.documentElement)
  .appendChild(script);

// Listen for messages from inject.js
window.addEventListener(
  'message',
  (event) => {

    // Ignore messages not from same page
    if (event.source !== window) {
      return;
    }

    // Ignore unrelated messages
    if (
      event.data?.type !==
      'APEX_API_TRACK'
    ) {
      return;
    }

    console.log(
      '[Apex] Content received:',
      event.data
    );

    // Forward to background.js
    chrome.runtime.sendMessage({

      type: 'LOG_TOKENS',

      data: event.data.payload

    }, (response) => {

      if (chrome.runtime.lastError) {

        console.error(
          '[Apex] Runtime error:',
          chrome.runtime.lastError
        );

        return;
      }

      console.log(
        '[Apex] Background response:',
        response
      );
    });
  }
);

