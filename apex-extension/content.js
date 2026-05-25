// Intercept fetch and XMLHttpRequest to track API calls
(function() {
  const API_CONFIGS = {
    groq: { domains: ['api.groq.com'], costPerToken: 0.00005 },
    cohere: { domains: ['api.cohere.com'], costPerToken: 0.0000075 },
    openai: { domains: ['api.openai.com'], costPerToken: 0.00002 },
    anthropic: { domains: ['api.anthropic.com'], costPerToken: 0.00003 },
    ollama: { domains: ['localhost:11434', '127.0.0.1:11434'], costPerToken: 0 }
  };

  // Intercept fetch
  const originalFetch = window.fetch;
  window.fetch = function(...args) {
    const url = args[0];
    
    return originalFetch.apply(this, args).then(response => {
      handleResponse(url, response.clone());
      return response;
    }).catch(error => {
      throw error;
    });
  };

  // Intercept XMLHttpRequest
  const originalOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function(method, url, ...rest) {
    this._url = url;
    this._method = method;
    return originalOpen.apply(this, [method, url, ...rest]);
  };

  const originalSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.send = function(...args) {
    const originalOnReadyStateChange = this.onreadystatechange;
    
    this.onreadystatechange = function() {
      if (this.readyState === 4) {
        try {
          handleXHRResponse(this._url, this.responseText, this.getResponseHeader('content-type'));
        } catch (e) {
          console.error('Error in onreadystatechange:', e);
        }
      }
      if (originalOnReadyStateChange) {
        originalOnReadyStateChange.apply(this, arguments);
      }
    };
    
    return originalSend.apply(this, args);
  };

  function handleResponse(url, response) {
    response.text().then(text => {
      handleXHRResponse(url, text, response.headers.get('content-type'));
    }).catch(e => {
      console.error('Error reading response:', e);
    });
  }

  function handleXHRResponse(url, responseText, contentType) {
    // Check which API this is
    for (const [apiName, config] of Object.entries(API_CONFIGS)) {
      const isMatch = config.domains.some(domain => url.includes(domain));
      
      if (isMatch && contentType && contentType.includes('application/json')) {
        try {
          const data = JSON.parse(responseText);
          const tokens = extractTokens(apiName, data, url);
          
          if (tokens > 0) {
            const cost = tokens * config.costPerToken;
            
            chrome.runtime.sendMessage({
              type: 'LOG_TOKENS',
              data: {
                apiName: apiName.toUpperCase(),
                tokens: tokens,
                model: extractModel(data, apiName),
                cost: cost
              }
            }, (response) => {
              if (chrome.runtime.lastError) {
                console.warn('Extension context invalid');
              }
            });
          }
        } catch (e) {
          console.error(`Error processing ${apiName} response:`, e);
        }
      }
    }
  }

  function extractTokens(apiName, data, url) {
    try {
      switch(apiName) {
        case 'groq':
          return data.usage?.total_tokens || 0;
        case 'cohere':
          return data.meta?.tokens || 0;
        case 'openai':
          return data.usage?.total_tokens || 0;
        case 'anthropic':
          return (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0);
        case 'ollama':
          return (data.prompt_tokens || 0) + (data.completion_tokens || 0);
        default:
          return 0;
      }
    } catch {
      return 0;
    }
  }

  function extractModel(data, apiName) {
    switch(apiName) {
      case 'groq':
        return data.model || 'unknown';
      case 'cohere':
        return data.model || 'unknown';
      case 'openai':
        return data.model || 'unknown';
      case 'anthropic':
        return data.model || 'unknown';
      case 'ollama':
        return data.model || 'unknown';
      default:
        return 'unknown';
    }
  }
})();