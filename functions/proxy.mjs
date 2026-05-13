export default async (req, context) => {
  // Set CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
  };

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('', { status: 200, headers });
  }

  try {
    // Get the API key from environment variables
    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'API key not configured' }), {
        status: 500,
        headers
      });
    }

    let backendUrl;
    if (process.env.REACT_APP_ENV === 'dev') {
      backendUrl = `http://localhost:8080`;
    } else {
      // Construct the backend URL
      backendUrl = `https://backend-cloud-run-gateway-5o71wi4q.uk.gateway.dev`;
    }

    // Parse the request body to get the endpoint
    let requestBody;
    try {
      const bodyText = await req.text();
      requestBody = JSON.parse(bodyText || '{}');
    } catch (e) {
      console.error('Body parse error:', e);
      return new Response(JSON.stringify({ error: 'Invalid JSON in request body' }), {
        status: 400,
        headers
      });
    }

    const endpoint = requestBody.endpoint;
    console.log('Endpoint:', endpoint);
    if (!endpoint) {
      // Forward the request to the backend
      const response = await fetch(backendUrl, {
        method: req.method,
        headers: {
          'Content-Type': 'application/json'
        },
      });

      const responseBody = await response.text();

      return new Response(responseBody, {
        status: response.status,
        headers: {
          ...headers,
          'Content-Type': 'application/json'
        }
      });
    }

    // Remove the endpoint from the body before forwarding
    delete requestBody.endpoint;

    backendUrl += endpoint;

    // Add the API key as a query parameter
    const url = new URL(backendUrl);

    if (process.env.REACT_APP_ENV === 'dev') {
      url.searchParams.set('key', apiKey);
    }

    // Forward the request to the backend
    console.log('request method:', req.method);
    const response = await fetch(url.toString(), {
      method: req.method,
      headers: {
        'Content-Type': req.headers.get('content-type') || 'application/json'
      },
      body: Object.keys(requestBody).length > 0 ? JSON.stringify(requestBody) : undefined
    });

    const responseBody = await response.text();

    return new Response(responseBody, {
      status: response.status,
      headers: {
        ...headers,
        'Content-Type': response.headers.get('content-type') || 'application/json'
      }
    });
  } catch (error) {
    console.error('Proxy error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers
    });
  }
};

export const config = {
  path: '/proxy'
};