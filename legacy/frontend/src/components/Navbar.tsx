import React, { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../redux/hooks';
import { logoutUser } from '../redux/actions/authActions';
import './Navbar.css';

const Navbar: React.FC = () => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { isAuthenticated, user, loading } = useAppSelector((state) => state.auth);

  console.log('Navbar render - Auth state:', { isAuthenticated, hasUser: !!user, loading });

  const handleLogout = () => {
    console.log('Navbar - Logout clicked');
    dispatch(logoutUser());
    navigate('/login');
  };

  return (
    <nav className="navbar">
      <div className="navbar-container">
        <Link to="/" className="navbar-logo">
          StoryQuest
        </Link>
        <div className="navbar-menu">
          {loading ? (
            <div className="navbar-loading">Loading...</div>
          ) : isAuthenticated ? (
            <>
              <div className="navbar-user">
                Welcome, {user?.username || 'Adventurer'}
              </div>
              <Link to="/" className="navbar-item">
                Dashboard
              </Link>
              <button onClick={handleLogout} className="navbar-button">
                Logout
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className="navbar-item">
                Login
              </Link>
              <Link to="/register" className="navbar-item">
                Register
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navbar; 