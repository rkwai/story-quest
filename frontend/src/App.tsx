import React, { useEffect, useState } from 'react';
import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { LoginPage, RegisterPage } from './features/authentication';
import { DashboardPage } from './features/dashboard';
import { CampaignDetailPage } from './features/campaigns';
import { CharacterCreationPage } from './features/characters';
import Navbar from './components/Navbar';
import { loadUser, setAuthToken } from './redux/actions/authActions';
import { useAppDispatch, useAppSelector } from './redux/hooks';
import { setLoading } from './redux/reducers/authReducer';

const App: React.FC = () => {
  const dispatch = useAppDispatch();
  const location = useLocation();
  const navigate = useNavigate();
  const [initialLoadDone, setInitialLoadDone] = useState(false);
  const { isAuthenticated, loading, user, token } = useAppSelector((state) => state.auth);

  console.log('App render - Auth state:', { 
    isAuthenticated, 
    loading, 
    hasUser: !!user, 
    hasToken: !!token,
    path: location.pathname,
    initialLoadDone
  });

  // Initial load of user data
  useEffect(() => {
    const loadUserData = async () => {
      console.log('App useEffect - Loading user');
      
      // Check if token exists in localStorage
      const storedToken = localStorage.getItem('token');
      if (storedToken) {
        console.log('Token found in localStorage, setting auth token');
        setAuthToken(storedToken);
        
        try {
          await dispatch(loadUser());
        } catch (error) {
          console.error('Error loading user:', error);
        }
      } else {
        console.log('No token found in localStorage, skipping user load');
        dispatch(setLoading(false));
      }
      
      setInitialLoadDone(true);
      console.log('Initial user load complete');
    };
    
    loadUserData();
  }, [dispatch]);

  // Handle authentication state changes
  useEffect(() => {
    if (!initialLoadDone) return;
    
    console.log('Auth state changed:', { 
      isAuthenticated, 
      loading, 
      path: location.pathname,
      initialLoadDone
    });
    
    // If user is authenticated and on login/register page, redirect to dashboard
    if (isAuthenticated && (location.pathname === '/login' || location.pathname === '/register')) {
      console.log('Redirecting to dashboard from login/register page');
      navigate('/');
    }
  }, [isAuthenticated, loading, location.pathname, navigate, initialLoadDone]);

  // Protected route component
  const PrivateRoute = ({ children }: { children: React.ReactNode }) => {
    console.log('PrivateRoute - Auth state:', { isAuthenticated, loading, path: location.pathname });
    
    if (!initialLoadDone || loading) {
      console.log('PrivateRoute - Loading...');
      return <div className="loading-container">Loading...</div>;
    }
    
    if (!isAuthenticated) {
      console.log('PrivateRoute - Not authenticated, redirecting to login');
      return <Navigate to="/login" />;
    }
    
    console.log('PrivateRoute - Authenticated, rendering children');
    return <>{children}</>;
  };

  return (
    <div className="app">
      <Navbar />
      <main className="container">
        {/* Debug info */}
        <div style={{ 
          fontSize: '12px', 
          color: '#666', 
          padding: '5px', 
          marginBottom: '10px',
          backgroundColor: '#f8f9fa',
          borderRadius: '4px'
        }}>
          App State: isAuthenticated={isAuthenticated ? 'true' : 'false'}, 
          loading={loading ? 'true' : 'false'},
          initialLoadDone={initialLoadDone ? 'true' : 'false'},
          path={location.pathname}
        </div>
        
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route 
            path="/" 
            element={
              <PrivateRoute>
                <DashboardPage />
              </PrivateRoute>
            } 
          />
          <Route 
            path="/campaigns/:id" 
            element={
              <PrivateRoute>
                <CampaignDetailPage />
              </PrivateRoute>
            } 
          />
          <Route 
            path="/campaigns/:campaignId/characters/:characterId?" 
            element={
              <PrivateRoute>
                <CharacterCreationPage />
              </PrivateRoute>
            } 
          />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </main>
    </div>
  );
};

export default App; 