import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { authAPI } from '../services/api';
import '../styles/Auth.css';

function Login({ isLoginMode }) {
  const [isLogin, setIsLogin] = useState(isLoginMode);
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    password2: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  // Update mode when route changes
  useEffect(() => {
    setIsLogin(isLoginMode);
  }, [isLoginMode]);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
    setError(''); // Clear error when user types
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isLogin) {
        // Login
        const response = await authAPI.login({
          username: formData.username,
          password: formData.password,
        });
        
        // Save token to localStorage
        localStorage.setItem('token', response.data.token);
        localStorage.setItem('username', formData.username);
        
        // Redirect to dashboard
        navigate('/dashboard');
      } else {
        // Register
        if (formData.password !== formData.password2) {
          setError('Passwords do not match!');
          setLoading(false);
          return;
        }

        await authAPI.register({
          username: formData.username,
          email: formData.email,
          password: formData.password,
        });

        // Auto-login after registration
        const loginResponse = await authAPI.login({
          username: formData.username,
          password: formData.password,
        });

        localStorage.setItem('token', loginResponse.data.token);
        localStorage.setItem('username', formData.username);
        
        navigate('/dashboard');
      }
      } catch (err) {
        console.error('Auth error:', err);
        // Use the improved error message from interceptor
        setError(err.message || 'An error occurred. Please try again.');
      } finally {
        setLoading(false);
      }
  };

  const toggleMode = () => {
    setError('');
    setFormData({
      username: '',
      email: '',
      password: '',
      password2: '',
    });
    // Navigate to the other route
    navigate(isLogin ? '/register' : '/login');
  };

  return (
    <div className="auth-container">
      <div className="auth-box">
        <h1>SMM Assistant</h1>
        <h2>{isLogin ? 'Login' : 'Create Account'}</h2>

        {error && <div className="error-message">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Username</label>
            <input
              type="text"
              name="username"
              value={formData.username}
              onChange={handleChange}
              required
              disabled={loading}
              placeholder="Enter username"
            />
          </div>

          {!isLogin && (
            <div className="form-group">
              <label>Email</label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                required
                disabled={loading}
                placeholder="Enter email"
              />
            </div>
          )}

          <div className="form-group">
            <label>Password</label>
            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              required
              disabled={loading}
              placeholder="Enter password"
            />
          </div>

          {!isLogin && (
            <div className="form-group">
              <label>Confirm Password</label>
              <input
                type="password"
                name="password2"
                value={formData.password2}
                onChange={handleChange}
                required
                disabled={loading}
                placeholder="Confirm password"
              />
            </div>
          )}

          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? 'Please wait...' : (isLogin ? 'Login' : 'Register')}
          </button>
        </form>

        <p className="toggle-text">
          {isLogin ? "Don't have an account? " : 'Already have an account? '}
          <span onClick={toggleMode} className="toggle-link">
            {isLogin ? 'Register here' : 'Login here'}
          </span>
        </p>
      </div>
    </div>
  );
}

export default Login;