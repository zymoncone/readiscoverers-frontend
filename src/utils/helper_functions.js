/*************************************************************************
 * fetchWithRetry
 *
 * Performs a fetch request with exponential backoff retry logic.
 * Useful for handling CloudRun cold starts and transient server errors.
 *************************************************************************/
export const fetchWithRetry = async (
  url,
  options,
  maxRetries = 6,
  initialDelay = 5000,
  maxDelay = 30000,
  onRetry = null
) => {
  const secret = process.env.REACT_APP_PROXY_SECRET;
  const mergedOptions = {
    ...options,
    headers: {
      ...(options?.headers || {}),
      ...(secret ? { 'x-proxy-secret': secret } : {})
    }
  };

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, mergedOptions);

      // If successful, return the response
      if (response.ok) {
        return response;
      }

      // For 5xx errors or 429 (rate limit), retry with backoff
      if ((attempt < maxRetries) &&
          (response.status >= 500 || response.status === 429)) {
        const delay = Math.min(initialDelay * Math.pow(2, attempt), maxDelay);
        console.log(
          `API request failed with status ${response.status}. ` +
          `Retrying in ${delay}ms... ` +
          `(Attempt ${attempt + 1}/${maxRetries})`
        );
        if (onRetry) onRetry({ attempt, status: response.status, isColdStart: response.status === 504 });
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }

      // For other errors (4xx except 429), don't retry
      return response;
    } catch (error) {
      // Network errors or fetch failures
      if (attempt < maxRetries) {
        const delay = Math.min(initialDelay * Math.pow(2, attempt), maxDelay);
        console.log(
          `Network error: ${error.message}. ` +
          `Retrying in ${delay}ms... ` +
          `(Attempt ${attempt + 1}/${maxRetries})`
        );
        if (onRetry) onRetry({ attempt, status: null, isColdStart: false });
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      throw error;
    }
  }
};
