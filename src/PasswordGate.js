import { useState, useEffect } from 'react';
import './PasswordGate.css';

const PasswordGate = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  // Get password from environment variable
  const CORRECT_PASSWORD = process.env.REACT_APP_SITE_PASSWORD;

  useEffect(() => {
    // Check if user is already authenticated in this session
    const auth = sessionStorage.getItem('isAuthenticated');
    if (auth === 'true') {
      setIsAuthenticated(true);
    }
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();

    if (password === CORRECT_PASSWORD) {
      setIsAuthenticated(true);
      sessionStorage.setItem('isAuthenticated', 'true');
      setError('');
    } else {
      setError('Incorrect password. Please try again.');
      setPassword('');
    }
  };

  if (isAuthenticated) {
    return children;
  }

  return (
    <>
      {children}
      <div className="password-gate">
        <div className="password-container">
          <div className="lock-icon">📚</div>
          <h1>Welcome to Readiscover.app</h1>
          <p>For early access please enter the password.</p>

          <form onSubmit={handleSubmit} className="password-form">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
              className="password-input"
              autoFocus
            />
            <button type="submit" className="password-button">
              Submit
            </button>
          </form>

          {error && (
            <div className="password-error">
              {error}
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default PasswordGate;
