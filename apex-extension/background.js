
chrome.runtime.onMessage.addListener(
  (request, sender, sendResponse) => {

    console.log(
      '[Apex] Background received:',
      request
    );

    if (
      request.type === 'LOG_TOKENS'
    ) {

      logTokensToBackend(
        request.data
      );

      sendResponse({
        success: true
      });

      return true;
    }
  }
);

async function logTokensToBackend(
  data
) {

  try {

    const result =
      await chrome.storage.local.get([
        'access_token'
      ]);

    if (!result.access_token) {

      console.warn(
        '[Apex] No access token found'
      );

      return;
    }

    const payload = {

      api_name:
        data.apiName,

      tokens_used:
        data.totalTokens,

      model_used:
        data.model,

      cost_estimate:
        data.cost
    };

    console.log(
      '[Apex] Sending to backend:',
      payload
    );

    const response = await fetch(
      'http://localhost:8000/api/token-logs',
      {

        method: 'POST',

        headers: {

          'Content-Type':
            'application/json',

          'Authorization':
            `Bearer ${result.access_token}`
        },

        body: JSON.stringify(
          payload
        )
      }
    );

    console.log(
      '[Apex] Backend status:',
      response.status
    );

    const responseData =
      await response.text();

    console.log(
      '[Apex] Backend response:',
      responseData
    );

  } catch (error) {

    console.error(
      '[Apex] Backend logging failed:',
      error
    );
  }
}
