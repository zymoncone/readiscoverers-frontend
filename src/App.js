import { useState, useEffect } from 'react';
import './App.css';
import BackgroundAnimation from './BackgroundAnimation';

function App() {
  // Step management
  const [step, setStep] = useState('book-upload'); // 'book-upload', 'transitioning', or 'query'

  // Book upload state
  const [bookUrl, setBookUrl] = useState('');
  const [localFilename, setLocalFilename] = useState('');
  const [chunkSize, setChunkSize] = useState(1200);

  // Query state
  const [query, setQuery] = useState('');
  const [topK, setTopK] = useState(3);

  // UI state
  const [loading, setLoading] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [response, setResponse] = useState(null);
  const [error, setError] = useState(null);
  const [devMode, setDevMode] = useState(false);
  const [showBubbleTransition, setShowBubbleTransition] = useState(false);

  // Progress bar simulation for book upload
  useEffect(() => {
    let interval;
    if (loading && step === 'book-upload') {
      setLoadingProgress(0);
      interval = setInterval(() => {
        setLoadingProgress(prev => {
          if (prev >= 95) return prev; // Cap at 95% until response
          return prev + 5;
        });
      }, 1000); // Update every second
    }
    return () => clearInterval(interval);
  }, [loading, step]);

  const getApiUrl = (endpoint) => {
    const isDev = process.env.REACT_APP_ENV === 'dev';
    const baseUrl = isDev
      ? 'http://localhost:8080'
      : `https://backend-cloud-run-gateway-5o71wi4q.uk.gateway.dev`;

    return isDev ? `${baseUrl}${endpoint}` : `${baseUrl}${endpoint}?key=${process.env.REACT_APP_API_KEY}`;
  };

  const handleBookUpload = async (e) => {
    e.preventDefault();

    // Use defaults if fields are empty
    const finalBookUrl = bookUrl.trim() || 'https://www.gutenberg.org/cache/epub/55/pg55.txt';
    const finalLocalFilename = localFilename.trim() || 'wizard-of-oz';

    setLoading(true);
    setError(null);
    setResponse(null);

    try {
      const apiUrl = getApiUrl('/v1/book-data');

      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url: finalBookUrl,
          local_filename: finalLocalFilename,
          chunk_size: chunkSize
        }),
      });

      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }

      const data = await res.json();
      console.log('Book data uploaded successfully:', data);
      // Update state with the actual values used (including defaults)
      setLocalFilename(finalLocalFilename);
      setLoadingProgress(100);
      // Trigger bubble transition
      setShowBubbleTransition(true);
      setTimeout(() => {
        setStep('query');
        setShowBubbleTransition(false);
      }, 1200); // Match CSS animation duration

    } catch (err) {
      console.error('Book upload error:', err);
      setError(err.message || 'An error occurred while uploading the book');
    } finally {
      setLoading(false);
    }
  };

  const handleQuery = async (e) => {
    e.preventDefault();

    if (!query.trim()) {
      setError('Please enter a query');
      return;
    }

    setLoading(true);
    setError(null);
    setResponse(null);

    try {
      const apiUrl = getApiUrl('/v1/search-response');

      // Add minimum loading time for smooth UX (500ms)
      const [res] = await Promise.all([
        fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            query: query,
            local_filename: localFilename,
            top_k: topK
          }),
        }),
        new Promise(resolve => setTimeout(resolve, 2000))
      ]);

      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }

      const data = await res.json();
      setResponse(data);

    } catch (err) {
      setError(err.message || 'An error occurred while searching');
    } finally {
      setLoading(false);
    }
  };


  return (
    <div className="App">
      <BackgroundAnimation />

      {showBubbleTransition && (
        <div className="bubble-transition">
          <div className="bubble"></div>
        </div>
      )}

      <div className={`container ${step === 'query' && !response ? 'minimal' : ''}`}>
        {step === 'book-upload' && (
          <>
            <div className="header">
              <h1>readiscover.app</h1>
              <div className="dev-toggle">
                <label className="toggle-label">
                  <input
                    type="checkbox"
                    checked={devMode}
                    onChange={(e) => setDevMode(e.target.checked)}
                  />
                  <span className="toggle-slider"></span>
                  <span className="toggle-text">Dev Mode</span>
                </label>
              </div>
            </div>

            <h2>Upload Book</h2>
            <form onSubmit={handleBookUpload} className="search-form">
              <div className="form-group">
                <input
                  type="text"
                  value={bookUrl}
                  onChange={(e) => setBookUrl(e.target.value)}
                  placeholder="Book URL (e.g., https://www.gutenberg.org/cache/epub/55/pg55.txt)"
                  className="search-input"
                  disabled={loading}
                />
              </div>

              <div className="form-group">
                <input
                  type="text"
                  value={localFilename}
                  onChange={(e) => setLocalFilename(e.target.value)}
                  placeholder="Filename (e.g., wizard-of-oz)"
                  className="search-input"
                  disabled={loading}
                />
              </div>

              {devMode && (
                <div className="form-group">
                  <label className="input-label">
                    Chunk Size: {chunkSize}
                  </label>
                  <input
                    type="number"
                    value={chunkSize}
                    onChange={(e) => setChunkSize(Number(e.target.value))}
                    className="search-input"
                    disabled={loading}
                    min="100"
                    max="5000"
                  />
                </div>
              )}

              <button
                type="submit"
                className="search-button"
                disabled={loading}
              >
                {loading ? 'Processing...' : 'Upload Book'}
              </button>
            </form>

            {loading && (
              <div className="progress-container">
                <div className="progress-bar">
                  <div
                    className="progress-fill"
                    style={{ width: `${loadingProgress}%` }}
                  ></div>
                </div>
                <p className="progress-text">{loadingProgress}% - Processing book...</p>
              </div>
            )}
          </>
        )}

        {step === 'query' && (
          <>
            <div className="query-header">
              <div className="dev-toggle-query">
                <label className="toggle-label">
                  <input
                    type="checkbox"
                    checked={devMode}
                    onChange={(e) => setDevMode(e.target.checked)}
                  />
                  <span className="toggle-slider"></span>
                  <span className="toggle-text">Dev Mode</span>
                </label>
              </div>
            </div>

            <form onSubmit={handleQuery} className="search-form">
              <div className="form-group">
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={`Search in ${localFilename}...`}
                  className="search-input query-input"
                  disabled={loading}
                  autoFocus
                />
              </div>

              {devMode && (
                <div className="form-group">
                  <label className="input-label">
                    Top K Results: {topK}
                  </label>
                  <input
                    type="number"
                    value={topK}
                    onChange={(e) => setTopK(Number(e.target.value))}
                    className="search-input"
                    disabled={loading}
                    min="1"
                    max="10"
                  />
                </div>
              )}

              <button
                type="submit"
                className="search-button"
                disabled={loading}
              >
                {loading ? 'Searching...' : 'Search'}
              </button>
            </form>

            {loading && (
              <div className="search-loading">
                  <div className="search-dots">
                    <span className="dot"></span>
                    <span className="dot"></span>
                    <span className="dot"></span>
                  </div>
                <p className="loading-text">Searching through pages...</p>
              </div>
            )}
          </>
        )}

        {error && (
          <div className="message error-message">
            <strong>Error:</strong> {error}
          </div>
        )}

        {response && step === 'query' && Array.isArray(response) && (
          <div className="results-container">
            {response.map((result, index) => (
              <div key={index} className="result-card">
                <div className="result-header">
                  <span className="chapter-info">
                    Chapter: {result.chapter_number_raw} - {result.chapter_name}
                  </span>
                  <span className="score-badge">
                    Score: {(result.score * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="result-text">
                  {result.text}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
