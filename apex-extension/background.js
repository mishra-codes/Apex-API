// API configuration - token extraction logic for each provider
const API_CONFIGS = {
  groq: {
    domains: ['api.groq.com'],
    getTokens: (response) => {
      // Groq returns x-groq-tokens-used in response headers
      // We'll extract this in content.js and pass it here
      return response.groqTokens || 0;
    },
    costPerToken: 0.00005
  },
  cohere: {
    domains: ['api.cohere.com'],
    getTokens: (response) => {
      // Cohere returns meta.tokens in response body
      try {
        const data = typeof response === 'string' ? JSON.parse(response) : response;
        return data?.meta?.tokens || 0;
      } catch {
        return 0;
      }
    },
    costPerToken: 0.0000075
  },
  openai: {
    domains: ['api.openai.com'],
    getTokens: (response) => {
      // OpenAI returns usage.total_tokens
      try {
        const data = typeof response === 'string' ? JSON.parse(response) : response;
        return data?.usage?.total_tokens || 0;
      } catch {
        return 0;
      }
    },
    costPerToken: 0.00002
  },
  anthropic: {
    domains: ['api.anthropic.com'],
    getTokens: (response) => {
      // Anthropic returns usage.input_tokens + usage.output_tokens
      try {
        const data = typeof response === 'string' ? JSON.parse(response) : response;
        const input = data?.usage?.input_tokens || 0;
        const output = data?.usage?.output_tokens || 0;
        return input + output;
      } catch {
        return 0;
      }
    },
    costPerToken: 0.00003
  },
  ollama: {
    domains: ['localhost:11434', '127.0.0.1:11434'],
    getTokens: (response) => {
      // Ollama returns prompt_tokens + completion_tokens
      try {
        const data = typeof response === 'string' ? JSON.parse(response) : response;
        const prompt = data?.prompt_tokens || 0;
        const completion = data?.completion_tokens || 0;
        return prompt + completion;
      } catch {
        return 0;
      }
    },
    costPerToken: 0  // Ollama is local, free
  }
};

// Listen for messages from content.js
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'LOG_TOKENS') {
    logTokensToBackend(request.data, sender.tab.id);
    sendResponse({ success: true });
  }
});

async function logTokensToBackend(data, tabId) {
  try {
    const token = await chrome.storage.local.get('access_token');
    
    if (!token.access_token) {
      console.warn('No access token found. Please login in Apex extension.');
      return;
    }

    const payload = {
      api_name: data.apiName,
      tokens_used: data.tokens,
      model_used: data.model || 'unknown',
      cost_estimate: data.cost
    };

    const response = await fetch('http://localhost:8000/api/token-logs', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token.access_token}`
      },
      body: JSON.stringify(payload)
    });

    if (response.ok) {
      console.log('✅ Tokens logged:', data);
    } else {
      console.error('❌ Failed to log tokens:', response.status);
    }
  } catch (error) {
    console.error('Error logging tokens:', error);
  }
}