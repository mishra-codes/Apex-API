// inject.js
// Runs in PAGE context

(() => {

  console.log('[Apex] Inject script running');

  // ---------------------------------------------------
  // CONFIG
  // ---------------------------------------------------

  const API_CONFIGS = {

    groq: {
      domains: ['api.groq.com'],
      costPerToken: 0.00005
    },

    openai: {
      domains: ['api.openai.com'],
      costPerToken: 0.00002
    },

    anthropic: {
      domains: ['api.anthropic.com'],
      costPerToken: 0.00003
    },

    cohere: {
      domains: ['api.cohere.com'],
      costPerToken: 0.0000075
    },

    ollama: {
      domains: [
        'localhost:11434',
        '127.0.0.1:11434'
      ],
      costPerToken: 0
    }
  };

  // ---------------------------------------------------
  // NOISY DOMAINS FILTER
  // ---------------------------------------------------

  const BLOCKED_DOMAINS = [

    'google-analytics.com',
    'facebook.com',
    'twitter.com',
    'analytics.twitter.com',
    'reddit.com',
    'linkedin.com',
    'intercom.io',
    'intercomcdn.com',
    'doubleclick.net'

  ];

  function shouldIgnore(url = '') {

    return BLOCKED_DOMAINS.some(domain =>
      url.includes(domain)
    );
  }

  // ---------------------------------------------------
  // SAFE URL EXTRACTION
  // ---------------------------------------------------

  function extractUrl(resource) {

    try {

      if (typeof resource === 'string') {
        return resource;
      }

      if (resource instanceof Request) {
        return resource.url;
      }

      if (resource?.url) {
        return resource.url;
      }

      return '';

    } catch (error) {

      console.error(
        '[Apex] URL extraction failed:',
        error
      );

      return '';
    }
  }

  // ---------------------------------------------------
  // FETCH INTERCEPTION
  // ---------------------------------------------------

  const originalFetch = window.fetch;

  window.fetch = async function (...args) {

    const startTime = performance.now();

    const url = extractUrl(args[0]);

    if (!url) {
      return originalFetch.apply(this, args);
    }

    if (shouldIgnore(url)) {
      return originalFetch.apply(this, args);
    }

    console.log('[Apex] Fetch URL:', url);

    try {

      const response =
        await originalFetch.apply(this, args);

      processFetchResponse(
        url,
        response.clone(),
        startTime
      );

      return response;

    } catch (error) {

      // Ignore aborted requests
      if (error?.name === 'AbortError') {

        console.warn(
          '[Apex] Request aborted:',
          url
        );

        throw error;
      }

      console.error(
        '[Apex] Fetch interception error:',
        error
      );

      throw error;
    }
  };

  // ---------------------------------------------------
  // XHR INTERCEPTION
  // ---------------------------------------------------

  const originalOpen =
    XMLHttpRequest.prototype.open;

  const originalSend =
    XMLHttpRequest.prototype.send;

  XMLHttpRequest.prototype.open =
    function (method, url, ...rest) {

      this._apexUrl = url;
      this._apexMethod = method;

      return originalOpen.apply(
        this,
        [method, url, ...rest]
      );
    };

  XMLHttpRequest.prototype.send =
    function (...args) {

      const startTime =
        performance.now();

      this.addEventListener(
        'readystatechange',
        () => {

          if (this.readyState !== 4) {
            return;
          }

          try {

            const url =
              this._apexUrl || '';

            if (!url) return;

            if (shouldIgnore(url)) {
              return;
            }

            console.log(
              '[Apex] XHR intercepted'
            );

            processXHRResponse(
              url,
              this.responseText,
              this.getResponseHeader(
                'content-type'
              ),
              this.status,
              startTime
            );

          } catch (error) {

            console.error(
              '[Apex] XHR interception error:',
              error
            );
          }
        }
      );

      return originalSend.apply(
        this,
        args
      );
    };

  // ---------------------------------------------------
  // FETCH RESPONSE PROCESSING
  // ---------------------------------------------------

  async function processFetchResponse(
    url,
    response,
    startTime
  ) {

    try {

      const contentType =
        response.headers.get(
          'content-type'
        ) || '';

      console.log(
        '[Apex] Content-Type:',
        contentType
      );

      if (!contentType) {
        return;
      }

      // ---------------------------------------------------
      // JSON RESPONSE
      // ---------------------------------------------------

      if (
        contentType.includes(
          'application/json'
        )
      ) {

        const responseText =
          await response.text();

        console.log(
          '[Apex] Fetch response text:',
          responseText
        );

        processAPIResponse(
          url,
          responseText,
          contentType,
          response.status,
          startTime
        );

        return;
      }

      // ---------------------------------------------------
      // SSE STREAM
      // ---------------------------------------------------

      if (
        contentType.includes(
          'text/event-stream'
        )
      ) {

        console.log(
          '[Apex] SSE stream detected'
        );

        await processSSEStream(
          url,
          response,
          startTime
        );
      }

    } catch (error) {

      if (error?.name === 'AbortError') {

        console.warn(
          '[Apex] Stream aborted'
        );

        return;
      }

      console.error(
        '[Apex] Error processing fetch response:',
        error
      );
    }
  }

  // ---------------------------------------------------
  // SSE STREAM PROCESSING
  // ---------------------------------------------------

  async function processSSEStream(
  url,
  response,
  startTime
) {

  try {

    if (!response.body) {
      return;
    }

    const reader =
      response.body.getReader();

    const decoder =
      new TextDecoder();

    let fullText = '';

    while (true) {

      try {

        const {
          done,
          value
        } = await reader.read();

        if (done) {
          break;
        }

        fullText += decoder.decode(
          value,
          { stream: true }
        );

      } catch (streamError) {

        // IMPORTANT:
        // Browser aborted stream
        // after response finished.
        // This is NORMAL.

        if (
          streamError?.name ===
          'AbortError'
        ) {

          console.warn(
            '[Apex] Stream closed normally'
          );

          break;
        }

        throw streamError;
      }
    }

    // FINAL DECODE
    fullText += decoder.decode();

    console.log(
      '[Apex] SSE full text:',
      fullText
    );

    extractStreamingTokens(
      url,
      fullText,
      startTime
    );

  } catch (error) {

    console.error(
      '[Apex] SSE processing failed:',
      error
    );
  }
}

  // ---------------------------------------------------
  // STREAM TOKEN EXTRACTION
  // ---------------------------------------------------

  function extractStreamingTokens(
    url,
    text,
    startTime
  ) {

    try {

      const lines =
        text.split('\n');

      let finalUsage = null;
      let model = 'unknown';

      for (const line of lines) {

        if (
          !line.startsWith('data:')
        ) {
          continue;
        }

        const jsonPart =
          line
            .replace('data:', '')
            .trim();

        if (
          !jsonPart ||
          jsonPart === '[DONE]'
        ) {
          continue;
        }

        try {

          const data =
            JSON.parse(jsonPart);

          if (data.model) {
            model = data.model;
          }

          if (data.usage) {
            finalUsage = data.usage;
          }

        } catch {
          // ignore malformed chunks
        }
      }

      if (!finalUsage) {

        console.warn(
          '[Apex] No usage data found in stream'
        );

        return;
      }

      const input =
        finalUsage.prompt_tokens || 0;

      const output =
        finalUsage.completion_tokens || 0;

      const total =
        input + output;

      sendTrackingEvent({

        apiName: 'GROQ',

        model,

        inputTokens: input,

        outputTokens: output,

        totalTokens: total,

        cost: total * 0.00005,

        latency:
          performance.now() -
          startTime,

        streaming: true
      });

    } catch (error) {

      console.error(
        '[Apex] Streaming parse failed:',
        error
      );
    }
  }

  // ---------------------------------------------------
  // XHR RESPONSE PROCESSING
  // ---------------------------------------------------

  function processXHRResponse(
    url,
    responseText,
    contentType,
    status,
    startTime
  ) {

    processAPIResponse(
      url,
      responseText,
      contentType,
      status,
      startTime
    );
  }

  // ---------------------------------------------------
  // COMMON API RESPONSE PROCESSOR
  // ---------------------------------------------------

  function processAPIResponse(
    url,
    responseText,
    contentType,
    status,
    startTime
  ) {

    if (!url || !contentType) {
      return;
    }

    if (
      !contentType.includes(
        'application/json'
      )
    ) {
      return;
    }

    for (
      const [apiName, config]
      of Object.entries(API_CONFIGS)
    ) {

      const matched =
        config.domains.some(domain =>
          url.includes(domain)
        );

      if (!matched) {
        continue;
      }

      try {

        const data =
          JSON.parse(responseText);

        const tokenData =
          extractTokens(
            apiName,
            data
          );

        if (
          tokenData.totalTokens <= 0
        ) {
          return;
        }

        const latency =
          performance.now() -
          startTime;

        const cost =
          tokenData.totalTokens *
          config.costPerToken;

        sendTrackingEvent({

          apiName:
            apiName.toUpperCase(),

          model:
            extractModel(data),

          inputTokens:
            tokenData.inputTokens,

          outputTokens:
            tokenData.outputTokens,

          totalTokens:
            tokenData.totalTokens,

          cost,

          latency,

          status,

          streaming: false
        });

      } catch (error) {

        console.error(
          `[Apex] ${apiName} parsing failed:`,
          error
        );
      }
    }
  }

  // ---------------------------------------------------
  // TOKEN EXTRACTION
  // ---------------------------------------------------

  function extractTokens(
    apiName,
    data
  ) {

    try {

      switch (apiName) {

        case 'openai':
        case 'groq': {

          const input =
            data?.usage
              ?.prompt_tokens || 0;

          const output =
            data?.usage
              ?.completion_tokens || 0;

          return {

            inputTokens: input,

            outputTokens: output,

            totalTokens:
              input + output
          };
        }

        case 'anthropic': {

          const input =
            data?.usage
              ?.input_tokens || 0;

          const output =
            data?.usage
              ?.output_tokens || 0;

          return {

            inputTokens: input,

            outputTokens: output,

            totalTokens:
              input + output
          };
        }

        case 'cohere': {

          const total =
            data?.meta?.tokens || 0;

          return {

            inputTokens: 0,

            outputTokens: total,

            totalTokens: total
          };
        }

        case 'ollama': {

          const prompt =
            data?.prompt_eval_count || 0;

          const completion =
            data?.eval_count || 0;

          return {

            inputTokens: prompt,

            outputTokens: completion,

            totalTokens:
              prompt + completion
          };
        }

        default:

          return {

            inputTokens: 0,

            outputTokens: 0,

            totalTokens: 0
          };
      }

    } catch {

      return {

        inputTokens: 0,

        outputTokens: 0,

        totalTokens: 0
      };
    }
  }

  // ---------------------------------------------------
  // MODEL EXTRACTION
  // ---------------------------------------------------

  function extractModel(data) {

    return (
      data?.model ||
      data?.data?.model ||
      'unknown'
    );
  }

  // ---------------------------------------------------
  // POST MESSAGE
  // ---------------------------------------------------

  function sendTrackingEvent(
    payload
  ) {

    try {

      console.log(
        '[Apex] Sending token event'
      );

      window.postMessage({

        type: 'APEX_API_TRACK',

        payload: {

          requestId:
            crypto.randomUUID(),

          timestamp:
            Date.now(),

          ...payload
        }

      }, '*');

    } catch (error) {

      console.error(
        '[Apex] postMessage failed:',
        error
      );
    }
  }

  console.log(
    '[Apex] Injected successfully'
  );

})();