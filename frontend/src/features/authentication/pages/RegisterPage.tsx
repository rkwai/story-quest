import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../../../redux/hooks';
import { register } from '../../../redux/actions/authActions';
import './RegisterPage.css';

const RegisterPage: React.FC = () => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { isAuthenticated, error, loading } = useAppSelector((state) => state.auth);
  
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: ''
  });
  const [formSubmitted, setFormSubmitted] = useState(false);
  const [passwordError, setPasswordError] = useState('');

  const { username, email, password, confirmPassword } = formData;

  console.log('RegisterPage render - Auth state:', { isAuthenticated, error, loading, formSubmitted });

  useEffect(() => {
    // If authenticated and form was submitted, redirect to dashboard
    if (isAuthenticated && formSubmitted) {
      console.log('RegisterPage - User registered and authenticated, redirecting to dashboard');
      navigate('/');
    }
  }, [isAuthenticated, navigate, formSubmitted]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    
    // Clear password error when user types in either password field
    if (e.target.name === 'password' || e.target.name === 'confirmPassword') {
      setPasswordError('');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate passwords match
    if (password !== confirmPassword) {
      setPasswordError('Passwords do not match');
      return;
    }
    
    console.log('RegisterPage - Register attempt with:', { username, email });
    setFormSubmitted(true);
    await dispatch(register({ username, email, password }));
  };

  return (
    <div className="register-page">
      <div className="register-container">
        <h2>Join StoryQuest</h2>
        <p>Create an account to start your adventure</p>
        
        {error && (
          <div className="alert alert-danger">
            {error}
          </div>
        )}
        
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="username">Username</label>
            <input
              type="text"
              id="username"
              name="username"
              value={username}
              onChange={handleChange}
              required
              className="form-control"
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              type="email"
              id="email"
              name="email"
              value={email}
              onChange={handleChange}
              required
              className="form-control"
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              type="password"
              id="password"
              name="password"
              value={password}
              onChange={handleChange}
              required
              className="form-control"
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="confirmPassword">Confirm Password</label>
            <input
              type="password"
              id="confirmPassword"
              name="confirmPassword"
              value={confirmPassword}
              onChange={handleChange}
              required
              className="form-control"
            />
            {passwordError && (
              <div className="error-message">{passwordError}</div>
            )}
          </div>
          
          <button type="submit" className="button button-primary" disabled={loading}>
            {loading ? 'Registering...' : 'Register'}
          </button>
        </form>
        
        <div className="register-footer">
          <p>
            Already have an account?{' '}
            <a href="/login" onClick={(e) => {
              e.preventDefault();
              navigate('/login');
            }}>
              Login here
            </a>
          </p>
        </div>
      </div>
    </div>
  );
};

export default RegisterPage; 