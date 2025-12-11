/*************************************************************************
 * fetchWithRetry
 *
 * Performs a fetch request with exponential backoff retry logic.
 * Useful for handling CloudRun cold starts and transient server errors.
 *************************************************************************/
export const fetchWithRetry = async (
  url,
  options,
  maxRetries = 3,
  initialDelay = 1000
) => {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);

      // If successful, return the response
      if (response.ok) {
        return response;
      }

      // For 5xx errors or 429 (rate limit), retry with backoff
      if ((attempt < maxRetries) &&
          (response.status >= 500 || response.status === 429)) {
        const delay = initialDelay * Math.pow(2, attempt);
        console.log(
          `API request failed with status ${response.status}. ,`
          `Retrying in ${delay}ms... `,
          `(Attempt ${attempt + 1}/${maxRetries})`
        );
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }

      // For other errors (4xx except 429), don't retry
      return response;
    } catch (error) {
      // Network errors or fetch failures
      if (attempt < maxRetries) {
        const delay = initialDelay * Math.pow(2, attempt);
        console.log(
          `Network error: ${error.message}. `,
          `Retrying in ${delay}ms... `,
          `(Attempt ${attempt + 1}/${maxRetries})`
        );
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      throw error;
    }
  }
};
