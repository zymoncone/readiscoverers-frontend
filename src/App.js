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
  const [isUploadingBook, setIsUploadingBook] = useState(false);
  const [showReady, setShowReady] = useState(false);

  // Progress bar simulation for book upload
  useEffect(() => {
    let interval;
    if (isUploadingBook) {
      setLoadingProgress(0);
      interval = setInterval(() => {
        setLoadingProgress(prev => {
          if (prev >= 95) return prev; // Cap at 95% until response
          return prev + 5;
        });
      }, 1000); // Update every second
    }
    return () => clearInterval(interval);
  }, [isUploadingBook]);

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

    // Immediately trigger the bubble and step transition
    setShowBubbleTransition(true);
    setTimeout(() => {
      setStep('query');
      setShowBubbleTransition(false);
    }, 1200); // Match CSS animation duration

    setLoading(true);
    setIsUploadingBook(true);
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

      // Show "Ready!" message
      setTimeout(() => {
        setShowReady(true);
        setTimeout(() => {
          setShowReady(false);
        }, 1500); // Show for 1.5 seconds
      }, 300);

    } catch (err) {
      console.error('Book upload error:', err);
      setError(err.message || 'An error occurred while uploading the book');
      // If there's an error, revert back to book-upload step
      setStep('book-upload');
      setShowBubbleTransition(false);
    } finally {
      setLoading(false);
      setIsUploadingBook(false);
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

      {/* Floating Dev Toggle - always visible */}
      <div className="dev-toggle-floating">
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

      {showBubbleTransition && (
        <div className="bubble-transition">
          <div className="bubble"></div>
        </div>
      )}

      <div className={`container ${step === 'query' && !response ? 'minimal' : ''}`}>
        {step === 'book-upload' && (
          <>
            <div className="header">
            </div>

            <div className="welcome-section">
              <h2 className="welcome-title">Search Inside Your Favorite Books</h2>
              <p className="welcome-description">
                Upload any book and search through its pages with AI-powered semantic search.
                Find passages, quotes, and ideas even if you don't remember the exact words.
              </p>

              <div className="how-it-works">
                <h3>How it works:</h3>
                <ol className="steps-list">
                  <li><span className="step-number">1</span> Provide a link to a book (try Project Gutenberg!)</li>
                  <li><span className="step-number">2</span> Give it a memorable name</li>
                  <li><span className="step-number">3</span> Search through the pages naturally</li>
                </ol>
              </div>
            </div>

            <form onSubmit={handleBookUpload} className="search-form">
              <div className="form-group">
                <label className="input-label">Book URL</label>
                <input
                  type="text"
                  value={bookUrl}
                  onChange={(e) => setBookUrl(e.target.value)}
                  placeholder="https://www.gutenberg.org/cache/epub/55/pg55.txt"
                  className="search-input"
                  disabled={loading}
                />
                <span className="input-hint">Leave empty to try "The Wizard of Oz"</span>
              </div>

              <div className="form-group">
                <label className="input-label">Book Name</label>
                <input
                  type="text"
                  value={localFilename}
                  onChange={(e) => setLocalFilename(e.target.value)}
                  placeholder="wizard-of-oz"
                  className="search-input"
                  disabled={loading}
                />
                <span className="input-hint">A friendly name for your book</span>
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
                {loading ? 'Processing...' : 'Start Reading'}
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
            {isUploadingBook || showReady ? (
              <div className="embeddings-loading">
                {!showReady ? (
                  <>
                    <div className="embeddings-icon">
                      <div className="floating-particles">
                        <span className="particle"></span>
                        <span className="particle"></span>
                        <span className="particle"></span>
                        <span className="particle"></span>
                        <span className="particle"></span>
                      </div>
                      <div className="book-icon">
                        <div className="book-cover"></div>
                        <div className="book-spine"></div>
                      </div>
                    </div>
                    <h3 className="embeddings-title">Creating Embeddings...</h3>
                    <p className="embeddings-description">Processing your book with AI</p>
                    <div className="progress-container">
                      <div className="progress-bar">
                        <div
                          className="progress-fill"
                          style={{ width: `${loadingProgress}%` }}
                        ></div>
                      </div>
                      <p className="progress-text">{loadingProgress}%</p>
                    </div>
                  </>
                ) : (
                  <div className="ready-message">
                    <div className="ready-icon">
                      <div className="checkmark-circle">
                        <svg viewBox="0 0 52 52" className="checkmark">
                          <circle className="checkmark-circle-bg" cx="26" cy="26" r="25" fill="none"/>
                          <path className="checkmark-check" fill="none" d="M14.1 27.2l7.1 7.2 16.7-16.8"/>
                        </svg>
                      </div>
                    </div>
                    <h2 className="ready-text">Ready!</h2>
                  </div>
                )}
              </div>
            ) : (
              <>
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
