import { useState } from 'react';
import './App.css';

function App() {
  const [inputValue, setInputValue] = useState('');
  const [response, setResponse] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    let apiUrl;

    if (!inputValue.trim()) {
      setError('Please enter some text');
      return;
    }

    setLoading(true);
    setError(null);
    setResponse(null);

    try {
      // Replace with your actual API endpoint
      if (process.env.REACT_APP_ENV === 'dev') {
        console.log('Development mode: using localhost API endpoint');
        apiUrl = 'http://localhost:8080/v1/model-response';
      } else {
        apiUrl = `https://backend-cloud-run-gateway-5o71wi4q.uk.gateway.dev/v1/model-response?key=${process.env.REACT_APP_API_KEY}`;
      }

      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_query: inputValue
        }),
      });

      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }

      const data = await res.json();
      setResponse(data);
      console.log(data);
    } catch (err) {
      setError(err.message || 'An error occurred while making the request');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="App">
      <div className="container">
        <h1>readiscover.app</h1>

        <form onSubmit={handleSubmit} className="search-form">
          <div className="input-group">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Enter your query..."
              className="search-input"
              disabled={loading}
            />
            <button
              type="submit"
              className="search-button"
              disabled={loading}
            >
              {loading ? 'Loading...' : 'Submit'}
            </button>
          </div>
        </form>

        {error && (
          <div className="message error-message">
            <strong>Error:</strong> {error}
          </div>
        )}

        {response && (
          <div className="message response-message">
            <h3>Response:</h3>
            <pre>{response.response}</pre>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
