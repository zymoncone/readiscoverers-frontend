import { useState, useEffect } from 'react';
import './App.css';
import './MultiBookStyles.css';
import './InlineProgress.css';
import BackgroundAnimation from './BackgroundAnimation';
import { fetchWithRetry } from './utils/helper_functions';
import { defaultBookUrls,
         targetChunkSize,
         sentenceOverlap,
         smallParagraphLength,
         smallParagraphOverlap,
         topK } from './constants';

function App() {
  // Book upload state
  const [bookUrlsInput, setBookUrlsInput] = useState(''); // Single comma-separated input
  const [processingUrls, setProcessingUrls] = useState([]); // URLs currently being processed
  const [books, setBooks] = useState([]); // Array of {filename, title, author, url}
  const [bookUploadStatuses, setBookUploadStatuses] = useState([]); // Track individual book progress
  const [bookTitles, setBookTitles] = useState([]); // Track book titles as they're received during processing

  // Query state
  const [query, setQuery] = useState('');

  // UI state
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState(null);
  const [error, setError] = useState(null);
  const [isUploadingBook, setIsUploadingBook] = useState(false);
  const [currentEncouragingMessage, setCurrentEncouragingMessage] = useState(0);
  const [loadingPhase, setLoadingPhase] = useState(null); // 'model' or 'search'
  const [modelResponse, setModelResponse] = useState(null);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [showBookInputs, setShowBookInputs] = useState(false);
  const [showCompletedBooks, setShowCompletedBooks] = useState(false);
  const [showCheckmark, setShowCheckmark] = useState(false);
  const [expandedResults, setExpandedResults] = useState({}); // Track which results are expanded

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

  // Helper function to highlight keywords within text
  const highlightKeywords = (text, keywords) => {
    if (!keywords || keywords.length === 0) return text;

    // Create a regex pattern that matches any of the keywords (case-insensitive)
    const keywordPattern = keywords
      .map(keyword => keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')) // Escape special regex characters
      .join('|');
    const regex = new RegExp(`(${keywordPattern})`, 'gi');

    const parts = text.split(regex);
    return parts.map((part, index) => {
      // Check if this part matches any keyword
      const isKeyword = keywords.some(keyword =>
        part.toLowerCase() === keyword.toLowerCase()
      );
      if (isKeyword) {
        return <strong key={index} className="keyword-highlight">{part}</strong>;
      }
      return part;
    });
  };

  // Helper function to extract matched chunks with context
  const getPreviewChunks = (matched_texts) => {
    if (!matched_texts) return null;

    const matchIndex = matched_texts.findIndex(chunk => chunk.is_match);
    if (matchIndex === -1) return matched_texts;

    // Get the matched chunk
    const matchedChunk = matched_texts[matchIndex];

    // Get context: previous and next chunks, but trim them to ~100 characters
    const prevChunk = matchIndex > 0 ? matched_texts[matchIndex - 1] : null;
    const nextChunk = matchIndex < matched_texts.length - 1 ? matched_texts[matchIndex + 1] : null;

    const result = [];

    // Add trimmed previous chunk (last ~100 chars) with ellipsis if needed
    if (prevChunk) {
      if (prevChunk.text.length > 100) {
        result.push({ text: '...', is_match: false, is_ellipsis: true });
        result.push({ text: prevChunk.text.slice(-100), is_match: false });
      } else {
        if (matchIndex > 0) {
          result.push({ text: '...', is_match: false, is_ellipsis: true });
        }
        result.push({ text: prevChunk.text, is_match: false });
      }
    } else if (matchIndex > 0) {
      result.push({ text: '...', is_match: false, is_ellipsis: true });
    }

    // Add the matched chunk
    result.push(matchedChunk);

    // Add trimmed next chunk (first ~100 chars) with ellipsis if needed
    if (nextChunk) {
      if (nextChunk.text.length > 100) {
        result.push({ text: nextChunk.text.slice(0, 100), is_match: false });
        result.push({ text: '...', is_match: false, is_ellipsis: true });
      } else {
        result.push({ text: nextChunk.text, is_match: false });
        if (matchIndex < matched_texts.length - 1) {
          result.push({ text: '...', is_match: false, is_ellipsis: true });
        }
      }
    } else if (matchIndex < matched_texts.length - 1) {
      result.push({ text: '...', is_match: false, is_ellipsis: true });
    }

    return result;
  };

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
      const res = await fetchWithRetry(apiUrl, {
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

      // Update book title as soon as we have it
      if (data.book_title) {
        setBookTitles(prev => {
          const newTitles = [...prev];
          newTitles[index] = data.book_title;
          return newTitles;
        });
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

    // Parse comma-separated URLs
    const urlsText = bookUrlsInput.trim();

    // Check if input contains commas for multiple URLs or is a single URL
    let finalUrls;
    if (!urlsText) {
      // Use default if empty - different defaults for dev mode vs production
      finalUrls = defaultBookUrls;
    } else if (urlsText.includes(',')) {
      // Split by comma and clean up
      finalUrls = urlsText.split(',').map(url => url.trim()).filter(url => url);
    } else {
      // Single URL
      finalUrls = [urlsText];
    }

    if (finalUrls.length === 0) {
      setError('Please enter at least one valid URL');
      return;
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
    setProcessingUrls(finalUrls); // Store URLs being processed

    // Initialize statuses and titles for all books
    setBookUploadStatuses(finalUrls.map(() => ({ status: 'pending', progress: 0, error: null })));
    setBookTitles(finalUrls.map(() => null)); // Initialize with null values

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
      setTimeout(() => {
        setShowCompletedBooks(true);
        // Show checkmark for 2 seconds before transitioning to open book
        setTimeout(() => {
          setShowCheckmark(true);
          setTimeout(() => {
            setShowCheckmark(false);
          }, 2000);
        }, 800);
      }, 1200); // Wait 1.2s to let checkmarks display and animate

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
    setModelResponse(null);

    try {
      // Get LLM-enhanced search query
      setLoadingPhase('model');
      const modelApiUrl = getApiUrl('/v1/model-response');

      const [modelRes] = await Promise.all([
        fetchWithRetry(modelApiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            user_query: query
          }),
        }),
        new Promise(resolve => setTimeout(resolve, 0)) // Minimum for model phase
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

      // Use enhanced query for semantic search
      setLoadingPhase('search');
      const searchApiUrl = getApiUrl('/v1/search-response');

      // Generate a session ID
      const queryId = crypto.randomUUID();

      // Use enhanced query
      const [searchRes] = await Promise.all([
        fetchWithRetry(searchApiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            query: enhancedQuery,
            filenames: books.map(book => book.filename),
            top_k: topK,
            query_id: queryId,
            enhanced_query: true,
            keywords: modelData?.keywords || []
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

      {showInfoModal && (
        <div className="modal-overlay" onClick={() => setShowInfoModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setShowInfoModal(false)}>×</button>
            <h3>Search Your Favorite Books</h3>
            <p className="modal-description">
              Upload any book or series and explore its pages with AI-powered semantic search.
              Ask questions in natural language and get back real passages and quotes straight from the text.
            </p>
            <h4>How it works:</h4>
            <ol className="steps-list">
              <li><span className="step-number">1</span> Click the + button to add book URLs (Project Gutenberg works great!)</li>
              <li><span className="step-number">2</span> Our AI processes the text and builds searchable semantic embeddings.</li>
              <li><span className="step-number">3</span> Ask anything naturally - every answer we return is a direct excerpt from the book, so you always know it’s real.</li>
            </ol>
          </div>
        </div>
      )}

      <div className={`container ${!response && books.length === 0 && !isUploadingBook ? 'minimal' : ''} ${!response && (books.length > 0 || isUploadingBook) ? 'loaded' : ''}`}>
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

        {!response && books.length === 0 && !isUploadingBook && (
          <div className="landing-add-books">
            <button
              type="button"
              onClick={() => setShowBookInputs(true)}
              className="landing-add-books-button"
              disabled={loading}
            >
              <svg className="plus-icon-large" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19"></line>
                <line x1="5" y1="12" x2="19" y2="12"></line>
              </svg>
              <span className="add-books-text">Add Books to Start</span>
            </button>
          </div>
        )}

        <>
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

            {isUploadingBook && (
              <div className={`loading-notification ${showCompletedBooks ? 'fade-out' : ''}`}>
                <div className="loading-spinner"></div>
                <p className="encouraging-message">{encouragingMessages[currentEncouragingMessage]}</p>
              </div>
            )}

            {isUploadingBook && bookUploadStatuses.length > 0 && (
              <div className={`inline-books-progress ${showCompletedBooks ? 'fade-out' : ''}`}>
                <div className="inline-progress-list">
                  {bookUploadStatuses.map((status, index) => {
                    // Use book title if available, otherwise extract from URL
                    let bookName;
                    if (bookTitles[index]) {
                      bookName = bookTitles[index];
                    } else {
                      const url = processingUrls[index] || '';
                      const urlParts = url.split('/');
                      const lastPart = urlParts[urlParts.length - 1];
                      bookName = lastPart.split('?')[0] || `Book ${index + 1}`;
                    }

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
            )}
            {showBookInputs && (
              <div className="modal-overlay" onClick={() => setShowBookInputs(false)}>
                <div className="modal-content book-modal-content" onClick={(e) => e.stopPropagation()}>
                  <button className="modal-close" onClick={() => setShowBookInputs(false)}>×</button>
                  <h3>Add Books</h3>
                  <form onSubmit={handleBookUpload} className="book-upload-form">
                    <div className="form-group">
                      <label className="input-label">Book URLs (comma-separated for multiple books)</label>
                      <textarea
                        value={bookUrlsInput}
                        onChange={(e) => setBookUrlsInput(e.target.value)}
                        placeholder={`${defaultBookUrls[0]}, https://www.example.com/my-fav-book.html, ...`}
                        className="search-input book-urls-textarea"
                        disabled={loading}
                        rows={4}
                      />
                      <span className="input-hint">Leave empty to try the first seven Wizard of Oz books + "Jack Pumpkinhead of Oz"</span>
                    </div>

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
            )}
            {(books.length > 0 || isUploadingBook || response) && (
            <form onSubmit={handleQuery} className="search-form query-form-main">
              <div className="form-group query-input-group">
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Ask about themes, characters, or specific topics..."
                  className="search-input query-input"
                  disabled={loading || books.length === 0}
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
                  {books.length === 0 && !isUploadingBook && (
                    <div className="add-books-tooltip show">Add books to start</div>
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
          </>

        {error && (
          <div className="message error-message">
            <strong>Error:</strong> {error}
          </div>
        )}

        {response && Array.isArray(response) && (
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
                    Chapter {result.data.chapter_number}: {result.data.chapter_title}
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
                  {result.data.matched_texts ? (
                    (expandedResults[`result-${index}`] ? result.data.matched_texts : getPreviewChunks(result.data.matched_texts))?.map((chunk, chunkIndex) =>
                      chunk.is_match ? (
                        <mark key={chunkIndex} className="highlight-match">
                          {highlightKeywords(chunk.text, modelResponse?.keywords)}{' '}
                        </mark>
                      ) : chunk.is_ellipsis ? (
                        <span key={chunkIndex} className="ellipsis-text">{chunk.text} </span>
                      ) : (
                        <span key={chunkIndex}>{chunk.text} </span>
                      )
                    )
                  ) : (
                    result.data.text
                  )}
                </div>
                {result.data.matched_texts && !expandedResults[`result-${index}`] && (
                  <button
                    className="view-in-book-button"
                    onClick={() => setExpandedResults(prev => ({ ...prev, [`result-${index}`]: true }))}
                  >
                    View in book
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
