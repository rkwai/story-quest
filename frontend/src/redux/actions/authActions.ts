import axios from 'axios';
import { 
  userLoaded, 
  loginSuccess, 
  registerSuccess, 
  authError, 
  loginFail, 
  registerFail, 
  logout 
} from '../reducers/authReducer';
import { AppDispatch } from '../store';

// Set auth token in headers
export const setAuthToken = (token: string | null) => {
  if (token) {
    axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    console.log('Auth token set in headers:', token.substring(0, 15) + '...');
  } else {
    delete axios.defaults.headers.common['Authorization'];
    console.log('Auth token removed from headers');
  }
};

// Load user
export const loadUser = () => async (dispatch: AppDispatch) => {
  const token = localStorage.getItem('token');
  
  if (token) {
    setAuthToken(token);
    console.log('Token found in localStorage, setting auth token');
  } else {
    console.log('No token found in localStorage');
    return; // Exit early if no token
  }

  try {
    // Using global axios configuration
    console.log('Making request to /api/auth/me');
    
    const res = await axios.get('/api/auth/me');
    console.log('User loaded successfully:', res.data);
    
    dispatch(userLoaded(res.data));
  } catch (err: any) {
    console.error('Load user error:', err);
    const errorMessage = err.response?.data?.error || 'Authentication failed';
    console.log('Error message:', errorMessage);
    
    dispatch(authError(errorMessage));
  }
};

// Register user
interface RegisterFormData {
  username: string;
  email: string;
  password: string;
}

export const register = (
  formData: RegisterFormData
) => async (dispatch: AppDispatch) => {
  try {
    console.log('Register attempt with:', { ...formData, password: '****' });
    
    const res = await axios.post('/api/auth/register', formData);
    console.log('Register response:', res.data);
    
    // Set token in localStorage and headers
    localStorage.setItem('token', res.data.token);
    setAuthToken(res.data.token);
    
    dispatch(registerSuccess({
      token: res.data.token,
      user: {
        id: res.data.id,
        username: res.data.username,
        email: res.data.email,
        role: res.data.role || 'player'
      }
    }));
  } catch (err: any) {
    console.error('Register error:', err);
    const error = err.response?.data?.error || 'Registration failed';
    
    dispatch(registerFail(error));
  }
};

// Login user
interface LoginFormData {
  email: string;
  password: string;
}

export const login = (
  formData: LoginFormData
) => async (dispatch: AppDispatch) => {
  try {
    console.log('Login attempt with:', { email: formData.email, password: '****' });
    
    // Using global axios configuration
    console.log('Making request to /api/auth/login');
    
    const res = await axios.post('/api/auth/login', formData);
    
    console.log('Login response received:', {
      status: res.status,
      hasToken: !!res.data.token,
      hasUser: !!res.data.id
    });
    
    // Ensure token is in the response
    if (!res.data.token) {
      console.error('No token in login response');
      dispatch(loginFail('Authentication failed - No token received'));
      return;
    }
    
    // Set token in localStorage and headers
    localStorage.setItem('token', res.data.token);
    setAuthToken(res.data.token);
    
    // Dispatch login success with user data and token
    dispatch(loginSuccess({
      token: res.data.token,
      user: {
        id: res.data.id,
        username: res.data.username,
        email: res.data.email,
        role: res.data.role || 'player'
      }
    }));
    
    // Check authentication state after login
    console.log('Authentication state after login:', {
      token: !!localStorage.getItem('token'),
      isAuthenticated: true
    });
  } catch (err: any) {
    console.error('Login error:', err);
    let errorMessage = 'Login failed';
    
    if (err.response) {
      console.log('Error response:', {
        status: err.response.status,
        data: err.response.data
      });
      errorMessage = err.response.data?.error || 'Login failed';
    } else if (err.request) {
      console.log('Error request:', err.request);
      errorMessage = 'No response from server. Please check your connection.';
    } else {
      console.log('Error message:', err.message);
      errorMessage = err.message || 'Login failed';
    }
    
    dispatch(loginFail(errorMessage));
  }
};

// Logout
export const logoutUser = () => (dispatch: AppDispatch) => {
  localStorage.removeItem('token');
  setAuthToken(null);
  dispatch(logout());
}; 