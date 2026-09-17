import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../../../redux/hooks';
import { login } from '../../../redux/actions/authActions';
import './LoginPage.css';

const LoginPage: React.FC = () => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { isAuthenticated, error, loading } = useAppSelector((state) => state.auth);
  const [formSubmitted, setFormSubmitted] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  console.log('LoginPage render - Auth state:', { isAuthenticated, error, loading, formSubmitted });

  useEffect(() => {
    // If authenticated and form was submitted, redirect to dashboard
    if (isAuthenticated && formSubmitted) {
      console.log('LoginPage - User authenticated, redirecting to dashboard');
      navigate('/');
    }
  }, [isAuthenticated, navigate, formSubmitted]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('LoginPage - Login attempt with:', { email });
    setFormSubmitted(true);
    await dispatch(login({ email, password }));
  };

  return (
    <div className="login-page">
      <div className="login-container">
        <h2>Login to StoryQuest</h2>
        <p>Enter your credentials to continue your adventure</p>
        
        {error && (
          <div className="alert alert-danger">
            {error}
          </div>
        )}
        
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="form-control"
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="form-control"
            />
          </div>
          
          <button type="submit" className="button button-primary" disabled={loading}>
            {loading ? 'Logging in...' : 'Log In'}
          </button>
        </form>
        
        <div className="login-footer">
          <p>
            Don't have an account?{' '}
            <a href="/register" onClick={(e) => {
              e.preventDefault();
              navigate('/register');
            }}>
              Register here
            </a>
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage; 