// In-memory rate limiter: 30 requests per minute per IP
const rateLimitMap = new Map();
const RATE_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX = 30;

function isRateLimited(ip) {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return false;
  }
  if (entry.count >= RATE_LIMIT_MAX) return true;
  entry.count++;
  return false;
}

export default async (req, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
  };

  if (req.method === 'OPTIONS') {
    return new Response('', { status: 200, headers });
  }

  // Validate secret token
  const secret = process.env.REACT_APP_PROXY_SECRET;
  if (secret && req.headers.get('x-proxy-secret') !== secret) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers });
  }

  // Rate limit by client IP
  const clientIp = req.headers.get('x-nf-client-connection-ip') || req.headers.get('x-forwarded-for') || 'unknown';
  if (isRateLimited(clientIp)) {
    return new Response(JSON.stringify({ error: 'Too many requests' }), { status: 429, headers });
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
      backendUrl = process.env.BACKEND_URL;
      if (!backendUrl) {
        return new Response(JSON.stringify({ error: 'Backend not configured' }), { status: 500, headers });
      }
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

    const backendSecret = process.env.BACKEND_PROXY_SECRET;
    const endpoint = requestBody.endpoint;
    if (!endpoint) {
      // Forward the request to the backend
      const response = await fetch(backendUrl, {
        method: req.method,
        headers: {
          'Content-Type': 'application/json',
          ...(backendSecret ? { 'x-proxy-secret': backendSecret } : {})
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

    if (process.env.REACT_APP_ENV !== 'dev') {
      url.searchParams.set('key', apiKey);
    }

    // Forward the request to the backend
    const response = await fetch(url.toString(), {
      method: req.method,
      headers: {
        'Content-Type': req.headers.get('content-type') || 'application/json',
        ...(backendSecret ? { 'x-proxy-secret': backendSecret } : {})
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