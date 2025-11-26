import { useState, useEffect } from 'react';
import './App.css';
import './MultiBookStyles.css';
import './InlineProgress.css';
import BackgroundAnimation from './BackgroundAnimation';
import { defaultBookUrl } from './constants';

function App() {
  // Book upload state
  const [bookUrls, setBookUrls] = useState(['']); // Array of URLs
  const [books, setBooks] = useState([]); // Array of {filename, title, author, url}
  const [bookUploadStatuses, setBookUploadStatuses] = useState([]); // Track individual book progress
  const [targetChunkSize, setTargetChunkSize] = useState(800);
  const [sentenceOverlap, setSentenceOverlap] = useState(2);
  const [smallParagraphLength, setSmallParagraphLength] = useState(200);
  const [smallParagraphOverlap, setSmallParagraphOverlap] = useState(2);

  // Query state
  const [query, setQuery] = useState('');
  const [topK, setTopK] = useState(3);

  // UI state
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState(null);
  const [originalResponse, setOriginalResponse] = useState(null);
  const [error, setError] = useState(null);
  const [devMode, setDevMode] = useState(false);
  const [isUploadingBook, setIsUploadingBook] = useState(false);
  const [currentEncouragingMessage, setCurrentEncouragingMessage] = useState(0);
  const [loadingPhase, setLoadingPhase] = useState(null); // 'model' or 'search'
  const [modelResponse, setModelResponse] = useState(null);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [showBookInputs, setShowBookInputs] = useState(false);
  const [isInputFocused, setIsInputFocused] = useState(false);
  const [showCompletedBooks, setShowCompletedBooks] = useState(false);
  const [showCheckmark, setShowCheckmark] = useState(false);

  // Encouraging messages for book processing
  const encouragingMessages = [
    "Processing your books with AI...",
    "This may take a minute, hang tight!",
    "Creating embeddings for better search...",
    "Almost there, analyzing content...",
    "Building your book's search index..."
  ];

  // Rotate encouraging messages while processing
  useEffect(() => {
    let interval;
    if (isUploadingBook) {
      interval = setInterval(() => {
        setCurrentEncouragingMessage(prev => (prev + 1) % encouragingMessages.length);
      }, 4000); // Change message every 4 seconds
    } else {
      setCurrentEncouragingMessage(0);
    }
    return () => clearInterval(interval);
  }, [isUploadingBook, encouragingMessages.length]);

  // No longer using single progress bar - tracking individual book progress

  const getApiUrl = (endpoint) => {
    const isDev = (process.env.REACT_APP_ENV === 'dev');
    console.log('Environment:', isDev ? 'Development' : 'Production');
    const baseUrl = isDev
      ? 'http://localhost:8080'
      : `https://backend-cloud-run-gateway-5o71wi4q.uk.gateway.dev`;

    return isDev ? `${baseUrl}${endpoint}` : `${baseUrl}${endpoint}?key=${process.env.REACT_APP_API_KEY}`;
  };

  const processBook = async (url, index) => {
    const apiUrl = getApiUrl('/v1/book-data');

    // Update status to processing
    setBookUploadStatuses(prev => {
      const newStatuses = [...prev];
      newStatuses[index] = { status: 'processing', progress: 0, error: null };
      return newStatuses;
    });

    try {
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url: url,
          target_chunk_size: targetChunkSize,
          sentence_overlap: sentenceOverlap,
          small_paragraph_length: smallParagraphLength,
          small_paragraph_overlap: smallParagraphOverlap
        }),
      });

      if (!res.ok) {
        throw new Error(`Book data API error!`);
      }

      const data = await res.json();

      if (data.status === 'error') {
        throw new Error(data.message || 'An error occurred during book upload or parsing');
      }

      if (process.env.REACT_APP_ENV === 'dev') {
        console.log('Book data uploaded successfully:', data);
      }

      // Update status to complete
      setBookUploadStatuses(prev => {
        const newStatuses = [...prev];
        newStatuses[index] = { status: 'complete', progress: 100, error: null };
        return newStatuses;
      });

      // Add book to the books array
      return {
        filename: data.filename || '',
        title: data.book_title || '',
        author: data.book_author || '',
        url: url
      };

    } catch (err) {
      console.error('Book data error:', err);
      setBookUploadStatuses(prev => {
        const newStatuses = [...prev];
        newStatuses[index] = { status: 'error', progress: 0, error: err.message };
        return newStatuses;
      });
      return null;
    }
  };

  const handleBookUpload = async (e) => {
    e.preventDefault();

    // Filter out empty URLs and use default if all empty
    let finalUrls = bookUrls.filter(url => url.trim());
    if (finalUrls.length === 0) {
      finalUrls = [defaultBookUrl];
    }

    // Collapse book inputs after submission
    setShowBookInputs(false);

    setLoading(true);
    setIsUploadingBook(true);
    setError(null);
    setResponse(null);
    setBooks([]);
    setShowCompletedBooks(false);
    setShowCheckmark(false);

    // Initialize statuses for all books
    setBookUploadStatuses(finalUrls.map(() => ({ status: 'pending', progress: 0, error: null })));

    try {
      // Process all books asynchronously
      const bookPromises = finalUrls.map((url, index) => processBook(url, index));
      const results = await Promise.all(bookPromises);

      // Filter out failed uploads
      const successfulBooks = results.filter(book => book !== null);

      if (successfulBooks.length === 0) {
        throw new Error('All book uploads failed');
      }

      setBooks(successfulBooks);

      // Show completed books animation with staged transitions
      // Wait 1.2s to let checkmarks display and animate
      setTimeout(() => {
        setShowCompletedBooks(true);
        // Show checkmark for 2 seconds before transitioning to open book
        setTimeout(() => {
          setShowCheckmark(true);
          setTimeout(() => {
            setShowCheckmark(false);
          }, 2000);
        }, 800);
      }, 1200);

    } catch (err) {
      console.error('Book upload error:', err);
      setError(err.message || 'An error occurred during book upload');
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
    setOriginalResponse(null);
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
        throw new Error(`Model API error!`);
      }

      const modelData = await modelRes.json();

      if (modelData.status === 'error') {
        throw new Error(modelData.message || 'Model API returned an error');
      }

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

      // Generate a session ID
      const queryId = crypto.randomUUID();

      // In dev mode, search with both enhanced and original query
      if (devMode) {
        const [enhancedSearchRes, originalSearchRes] = await Promise.all([
          fetch(searchApiUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              query: enhancedQuery,
              filenames: books.map(book => book.filename),
              top_k: topK,
              query_id: queryId,
              enhanced_query: true
            }),
          }),
          fetch(searchApiUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              query: query,
              filenames: books.map(book => book.filename),
              top_k: topK,
              query_id: queryId,
              enhanced_query: false
            }),
          }),
          new Promise(resolve => setTimeout(resolve, 0)) // Minimum for search phase
        ]);

        if (!enhancedSearchRes.ok) {
          throw new Error(`Enhanced search API error!`);
        }
        if (!originalSearchRes.ok) {
          throw new Error(`Original search API error!`);
        }

        const enhancedData = await enhancedSearchRes.json();
        const originalData = await originalSearchRes.json();

        if (enhancedData.status === 'error') {
          throw new Error(enhancedData.message || 'An error occurred during enhanced search');
        }
        if (originalData.status === 'error') {
          throw new Error(originalData.message || 'An error occurred during original search');
        }
        setResponse(enhancedData.search_results || []);
        setOriginalResponse(originalData.search_results || []);
      } else {
        // Production mode: only use enhanced query
        const [searchRes] = await Promise.all([
          fetch(searchApiUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              query: enhancedQuery,
              filenames: books.map(book => book.filename),
              top_k: topK,
              query_id: queryId,
              enhanced_query: true
            }),
          }),
          new Promise(resolve => setTimeout(resolve, 0)) // Minimum for search phase
        ]);

        if (!searchRes.ok) {
          throw new Error(`Search API error! status`);
        }

        const data = await searchRes.json();

        if (data.status === 'error') {
          throw new Error(data.message || 'An error occurred during search');
        }

        setResponse(data.search_results);
      }

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

      {/* Corner Dev Toggle - small and unobtrusive */}
      <button
        className="dev-toggle-corner"
        onClick={() => setDevMode(!devMode)}
        title="Toggle Dev Mode"
        type="button"
      >
        <span className={`dev-indicator ${devMode ? 'active' : ''}`}></span>
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
              <li><span className="step-number">1</span> Click the + button to add book URLs (Project Gutenberg works great!)</li>
              <li><span className="step-number">2</span> Our AI processes and creates searchable embeddings from the text</li>
              <li><span className="step-number">3</span> Ask questions naturally—find passages even without exact words</li>
            </ol>
          </div>
        </div>
      )}

      <div className={`container ${!response ? 'minimal' : ''}`}>
        {/* Slogan with controls underneath */}
        {!response && books.length === 0 && !isUploadingBook && (
          <>
            <h1 className="landing-slogan">
              Read it long ago?<br /><span className="slogan-highlight">Readiscover</span> it in seconds.
            </h1>
            <div className="landing-controls">
              <button
                className="info-button-inline"
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
            </div>
          </>
        )}

        {/* Always show search interface */}
        <>
            {/* Show loaded books if any */}
            {books.length > 0 && !isUploadingBook && (
              <div className="books-list-display">
                {showCheckmark ? (
                  <svg className="checkmark-icon-small" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12"></polyline>
                  </svg>
                ) : (
                  <svg className="book-icon-open" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path>
                    <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path>
                  </svg>
                )}
                <div className="books-names">
                  {books.map((book, index) => (
                    <div key={index} className="book-item">
                      <span className="book-name">
                        {book.title && book.title !== 'Unknown Title'
                          ? book.title
                          : book.filename.replace(/_/g, ' ').split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}
                        {book.author && book.author !== 'Unknown Author' && (
                          <span className="book-author"> by {book.author}</span>
                        )}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Overall Loading Indicator - Notification style above books */}
            {isUploadingBook && (
              <div className={`loading-notification ${showCompletedBooks ? 'fade-out' : ''}`}>
                <div className="loading-spinner"></div>
                <p className="encouraging-message">{encouragingMessages[currentEncouragingMessage]}</p>
              </div>
            )}

            {/* Book Processing Progress - Only shown while uploading */}
            {isUploadingBook && bookUploadStatuses.length > 0 && (
              <div className={`inline-books-progress ${showCompletedBooks ? 'fade-out' : ''}`}>
                <div className="inline-progress-list">
                  {bookUploadStatuses.map((status, index) => {
                    // Extract book name from URL (last segment before any query params)
                    const url = bookUrls[index] || '';
                    const urlParts = url.split('/');
                    const lastPart = urlParts[urlParts.length - 1];
                    const bookName = lastPart.split('?')[0] || `Book ${index + 1}`;

                    return (
                      <div key={index} className="inline-book-item">
                        <div className="inline-book-status-icon">
                          {status.status === 'complete' && !showCompletedBooks ? (
                            <div className="check-icon-container">
                              <svg className="check-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="20 6 9 17 4 12"></polyline>
                              </svg>
                            </div>
                          ) : status.status === 'complete' && showCompletedBooks ? (
                            <div className="static-book-icon">
                              <div className="book-cover"></div>
                              <div className="book-spine"></div>
                            </div>
                          ) : status.status === 'error' ? (
                            <div className="error-icon-container">
                              <svg className="error-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="12" cy="12" r="10"></circle>
                                <line x1="15" y1="9" x2="9" y2="15"></line>
                                <line x1="9" y1="9" x2="15" y2="15"></line>
                              </svg>
                            </div>
                          ) : (
                            <div className="floating-book-icon">
                              <div className="book-cover"></div>
                              <div className="book-spine"></div>
                            </div>
                          )}
                        </div>
                        <span className="inline-book-number">{bookName}</span>
                        {status.error && (
                          <span className="inline-error-text">{status.error}</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}            {/* Collapsible Book URL Input Section - Now a Modal */}
            {showBookInputs && (
              <div className="modal-overlay" onClick={() => setShowBookInputs(false)}>
                <div className="modal-content book-modal-content" onClick={(e) => e.stopPropagation()}>
                  <button className="modal-close" onClick={() => setShowBookInputs(false)}>×</button>
                  <h3>Add Books</h3>
                  <form onSubmit={handleBookUpload} className="book-upload-form">
                    <div className="form-group">
                      <label className="input-label">Book URLs</label>
                      {bookUrls.map((url, index) => (
                    <div key={index} className="url-input-row">
                      <input
                        type="text"
                        value={url}
                        onChange={(e) => {
                          const newUrls = [...bookUrls];
                          newUrls[index] = e.target.value;
                          setBookUrls(newUrls);
                        }}
                        placeholder={index === 0 ? defaultBookUrl : "Another book URL..."}
                        className="search-input"
                        disabled={loading}
                      />
                      {bookUrls.length > 1 && (
                        <button
                          type="button"
                          onClick={() => {
                            const newUrls = bookUrls.filter((_, i) => i !== index);
                            setBookUrls(newUrls);
                          }}
                          className="remove-url-button"
                          disabled={loading}
                        >
                          ×
                        </button>
                      )}
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => setBookUrls([...bookUrls, ''])}
                    className="add-url-button"
                    disabled={loading}
                  >
                    + Add another book
                  </button>
                  <span className="input-hint">Leave first empty to try "The Wizard of Oz"</span>
                </div>

                {devMode && (
                  <>
                    <div className="form-group">
                      <label className="input-label">
                        Target Chunk Size: {targetChunkSize}
                      </label>
                      <input
                        type="number"
                        value={targetChunkSize}
                        onChange={(e) => setTargetChunkSize(Number(e.target.value))}
                        className="search-input"
                        disabled={loading}
                      />
                    </div>
                    <div className="form-group">
                      <label className="input-label">
                        Sentence Overlap: {sentenceOverlap}
                      </label>
                      <input
                        type="number"
                        value={sentenceOverlap}
                        onChange={(e) => setSentenceOverlap(Number(e.target.value))}
                        className="search-input"
                        disabled={loading}
                      />
                    </div>
                    <div className="form-group">
                      <label className="input-label">
                        Small Paragraph Length: {smallParagraphLength}
                      </label>
                      <input
                        type="number"
                        value={smallParagraphLength}
                        onChange={(e) => setSmallParagraphLength(Number(e.target.value))}
                        className="search-input"
                        disabled={loading}
                      />
                    </div>
                    <div className="form-group">
                      <label className="input-label">
                        Small Paragraph Overlap: {smallParagraphOverlap}
                      </label>
                      <input
                        type="number"
                        value={smallParagraphOverlap}
                        onChange={(e) => setSmallParagraphOverlap(Number(e.target.value))}
                        className="search-input"
                        disabled={loading}
                      />
                    </div>
                  </>
                )}

                    <button
                      type="submit"
                      className="search-button"
                      disabled={loading}
                    >
                      {loading ? 'Processing...' : 'Process Books'}
                    </button>
                  </form>
                </div>
              </div>
            )}            {/* Main Search Query Form - Always Visible */}
            <form onSubmit={handleQuery} className="search-form query-form-main">
              <div className="form-group query-input-group">
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onFocus={() => setIsInputFocused(true)}
                  onBlur={() => setIsInputFocused(false)}
                  placeholder="Ask about themes, characters, or specific topics..."
                  className="search-input query-input"
                  disabled={loading}
                  autoFocus
                />

                <button
                  type="button"
                  onClick={() => setShowBookInputs(true)}
                  className="plus-button-inline"
                  disabled={loading}
                >
                  <svg className="plus-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="5" x2="12" y2="19"></line>
                    <line x1="5" y1="12" x2="19" y2="12"></line>
                  </svg>
                  {books.length === 0 && (
                    <div className={`add-books-tooltip ${isInputFocused ? 'show' : ''}`}>Add books to start</div>
                  )}
                </button>
              </div>

              {books.length > 0 && (
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
              )}
            </form>

            {devMode && books.length > 0 && (
              <div className="topk-input-below">
                <label className="topk-label">
                  Top K: {topK}
                </label>
                <input
                  type="number"
                  value={topK}
                  onChange={(e) => setTopK(Number(e.target.value))}
                  className="topk-input"
                  disabled={loading}
                  min="1"
                  max="10"
                />
              </div>
            )}

            {loading && loadingPhase && (
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

        {error && (
          <div className="message error-message">
            <strong>Error:</strong> {error}
          </div>
        )}

        {response && Array.isArray(response) && (
          <>
            {devMode && originalResponse ? (
              <div className="comparison-container">
                <div className="comparison-column">
                  <h3 className="comparison-title">Enhanced Query Results</h3>
                  <div className="results-container">
                    {response.map((result, index) => (
                      <div key={index} className="result-card">
                        <div className="result-header">
                          <span className="chapter-info">
                            {books.length > 1 && result.data.book_title && (
                              <span className="book-source-badge">
                                {result.data.book_title}
                              </span>
                            )}
                            Chapter: {result.data.chapter_number} - {result.data.chapter_title}
                          </span>
                          <div className="badges-container">
                            {result.data.book_progress_percent !== undefined && (
                              <span className="progress-badge">
                                <svg className="location-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                                  <circle cx="12" cy="10" r="3"></circle>
                                </svg>
                                {result.data.book_progress_percent.toFixed(1)}%
                              </span>
                            )}
                            <span className="score-badge">
                              {(result.data.score * 100).toFixed(1)} score
                            </span>
                          </div>
                        </div>
                        <div className="result-text">
                          {result.data.text}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="comparison-column">
                  <h3 className="comparison-title">Original Query Results</h3>
                  <div className="results-container">
                    {originalResponse.map((result, index) => (
                      <div key={index} className="result-card">
                        <div className="result-header">
                          <span className="chapter-info">
                            {books.length > 1 && result.data.book_title && (
                              <span className="book-source-badge">
                                {result.data.book_title}
                              </span>
                            )}
                            Chapter: {result.data.chapter_number} - {result.data.chapter_title}
                          </span>
                          <div className="badges-container">
                            {result.data.book_progress_percent !== undefined && (
                              <span className="progress-badge">
                                <svg className="location-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                                  <circle cx="12" cy="10" r="3"></circle>
                                </svg>
                                {result.data.book_progress_percent.toFixed(1)}%
                              </span>
                            )}
                            <span className="score-badge">
                              {(result.data.score * 100).toFixed(1)} score
                            </span>
                          </div>
                        </div>
                        <div className="result-text">
                          {result.data.text}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="results-container">
                {response.map((result, index) => (
                  <div key={index} className="result-card">
                    <div className="result-header">
                      <span className="chapter-info">
                        {books.length > 1 && result.data.book_title && (
                          <span className="book-source-badge">
                            {result.data.book_title}
                          </span>
                        )}
                        Chapter: {result.data.chapter_number} - {result.data.chapter_title}
                      </span>
                      <div className="badges-container">
                        {result.data.book_progress_percent !== undefined && (
                          <span className="progress-badge">
                            <svg className="location-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                              <circle cx="12" cy="10" r="3"></circle>
                            </svg>
                            {result.data.book_progress_percent.toFixed(1)}%
                          </span>
                        )}
                        <span className="score-badge">
                          {(result.data.score * 100).toFixed(1)} score
                        </span>
                      </div>
                    </div>
                    <div className="result-text">
                      {result.data.text}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default App;
