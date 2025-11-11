import { useState, useEffect } from 'react';
import './App.css';
import BackgroundAnimation from './BackgroundAnimation';
import { defaultLocalFilename, defaultBookUrl } from './constants';

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
  const [readyComplete, setReadyComplete] = useState(false);
  const [loadingPhase, setLoadingPhase] = useState(null); // 'model' or 'search'
  const [modelResponse, setModelResponse] = useState(null);
  const [showInfoModal, setShowInfoModal] = useState(false);

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
    const isDev = (process.env.REACT_APP_ENV === 'dev');
    console.log('Environment:', isDev ? 'Development' : 'Production');
    const baseUrl = isDev
      ? 'http://localhost:8080'
      : `https://backend-cloud-run-gateway-5o71wi4q.uk.gateway.dev`;

    return isDev ? `${baseUrl}${endpoint}` : `${baseUrl}${endpoint}?key=${process.env.REACT_APP_API_KEY}`;
  };

  const handleBookUpload = async (e) => {
    e.preventDefault();

    // Use defaults if fields are empty
    const finalBookUrl = bookUrl.trim() || defaultBookUrl;
    const finalLocalFilename = localFilename.trim().toLowerCase().replace(/\s+/g, '_') || defaultLocalFilename;
    if (process.env.REACT_APP_ENV === 'dev') {
      console.log('Final Local Filename:', finalLocalFilename);
    }

    // Update state with the actual values immediately
    setLocalFilename(finalLocalFilename);

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
    setReadyComplete(false); // Reset ready completion status

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
      if (process.env.REACT_APP_ENV === 'dev') {
        console.log('Book data uploaded successfully:', data);
      }
      setLoadingProgress(100);

      // Show "Ready!" message
      setTimeout(() => {
        setShowReady(true);
        setTimeout(() => {
          setShowReady(false);
          setReadyComplete(true); // Mark that ready animation has completed
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
    setModelResponse(null);

    try {
      // Step 1: Get LLM-enhanced search query
      setLoadingPhase('model');
      const modelApiUrl = getApiUrl('/v1/model-response');

      const [modelRes] = await Promise.all([
        fetch(modelApiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            user_query: query
          }),
        }),
        new Promise(resolve => setTimeout(resolve, 1500)) // Minimum 1.5s for model phase
      ]);

      if (!modelRes.ok) {
        throw new Error(`Model API error! status: ${modelRes.status}`);
      }

      const modelData = await modelRes.json();
      if (process.env.REACT_APP_ENV === 'dev') {
        console.log('Full model response:', modelData);
      }

      // Handle case where API returns None or empty response
      if (!modelData || (modelData.search_query === null && modelData.enhanced_query === null)) {
        console.warn('Model API returned empty response, using original query');
      }

      const enhancedQuery = modelData?.search_query || modelData?.enhanced_query || query;
      setModelResponse(modelData);

      if (process.env.REACT_APP_ENV === 'dev') {
        console.log('Original query:', query);
        console.log('Enhanced query:', enhancedQuery);
        console.log('Keywords:', modelData?.keywords);
      }

      // Step 2: Use enhanced query for semantic search
      setLoadingPhase('search');
      const searchApiUrl = getApiUrl('/v1/search-response');

      const [searchRes] = await Promise.all([
        fetch(searchApiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            query: enhancedQuery,
            local_filename: localFilename,
            top_k: topK
          }),
        }),
        new Promise(resolve => setTimeout(resolve, 0)) // Minimum for search phase
      ]);

      if (!searchRes.ok) {
        throw new Error(`Search API error! status: ${searchRes.status}`);
      }

      const data = await searchRes.json();
      setResponse(data);

    } catch (err) {
      setError(err.message || 'An error occurred while searching');
    } finally {
      setLoading(false);
      setLoadingPhase(null);
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
            <button
              className="info-button-floating"
              onClick={() => setShowInfoModal(true)}
              type="button"
            >
              <svg className="info-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <circle cx="12" cy="12" r="10"></circle>
                <path d="M12 16v-4"></path>
                <circle cx="12" cy="8" r="0.5" fill="currentColor"></circle>
              </svg>
              How it works
            </button>

            {showInfoModal && (
              <div className="modal-overlay" onClick={() => setShowInfoModal(false)}>
                <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                  <button className="modal-close" onClick={() => setShowInfoModal(false)}>×</button>
                  <h3>Search Inside Your Favorite Books</h3>
                  <p className="modal-description">
                    Upload any book and search through its pages with AI-powered semantic search.
                    Find passages, quotes, and ideas even if you don't remember the exact words.
                  </p>
                  <h4>How it works:</h4>
                  <ol className="steps-list">
                    <li><span className="step-number">1</span> Provide a link to a book (try Project Gutenberg!)</li>
                    <li><span className="step-number">2</span> Give it a memorable name</li>
                    <li><span className="step-number">3</span> Search through the pages naturally</li>
                  </ol>
                </div>
              </div>
            )}

            <div className="main-title-section">
              <h2 className="main-title">Provide a book, ask anything.</h2>
            </div>

            <form onSubmit={handleBookUpload} className="search-form">
              <div className="form-group">
                <label className="input-label">Book URL</label>
                <input
                  type="text"
                  value={bookUrl}
                  onChange={(e) => setBookUrl(e.target.value)}
                  placeholder={defaultBookUrl}
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
                  placeholder={defaultLocalFilename}
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
            {(isUploadingBook || showReady || !readyComplete) ? (
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
                <div className="book-title-display">
                  <svg className="book-icon-small" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path>
                    <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path>
                  </svg>
                  <span className="book-name">
                    {localFilename.replace(/_/g, ' ').split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}
                  </span>
                </div>
                <form onSubmit={handleQuery} className="search-form">
              <div className="form-group query-input-group">
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Ask about themes, characters, or specific topics..."
                  className="search-input query-input"
                  disabled={loading}
                  autoFocus
                />
                <button
                  type="submit"
                  className="send-button"
                  disabled={loading}
                  title="Send"
                >
                  <svg className="paper-plane-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="22" y1="2" x2="11" y2="13"></line>
                    <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                  </svg>
                  <span className="send-text">Send</span>
                </button>
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
            </form>

            {loading && (
              <div className="search-loading">
                <div className="search-dots">
                  <span className="dot"></span>
                  <span className="dot"></span>
                  <span className="dot"></span>
                </div>
                <p className="loading-text">
                  {loadingPhase === 'model' ? 'Analyzing your question...' : 'Searching through pages...'}
                </p>
              </div>
            )}

            {devMode && modelResponse && !loading && (
              <div className="model-response-debug">
                <h4>Model Response (Dev Mode)</h4>
                <div className="debug-item">
                  <strong>Enhanced Query:</strong>
                  <p className="debug-value">{modelResponse.search_query}</p>
                </div>
                <div className="debug-item">
                  <strong>Keywords:</strong>
                  <p className="debug-value">{modelResponse.keywords?.join(', ') || 'None'}</p>
                </div>
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
                  <div className="badges-container">
                    {result.book_progress_percent !== undefined && (
                      <span className="progress-badge">
                        <svg className="location-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                          <circle cx="12" cy="10" r="3"></circle>
                        </svg>
                        {result.book_progress_percent.toFixed(1)}%
                      </span>
                    )}
                    <span className="score-badge">
                      {(result.score * 100).toFixed(1)}% match
                    </span>
                  </div>
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
