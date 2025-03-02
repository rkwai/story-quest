import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export interface User {
  id: number;
  username: string;
  email: string;
  role: 'player' | 'admin';
}

export interface AuthState {
  token: string | null;
  isAuthenticated: boolean;
  loading: boolean;
  user: User | null;
  error: string | null;
}

// Initialize state with token from localStorage
const token = localStorage.getItem('token');
console.log('Initial auth state - token from localStorage:', !!token);

const initialState: AuthState = {
  token,
  isAuthenticated: !!token, // Set to true if token exists
  loading: true,
  user: null,
  error: null
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    userLoaded: (state, action: PayloadAction<User>) => {
      console.log('userLoaded reducer called with:', action.payload);
      state.isAuthenticated = true;
      state.loading = false;
      state.user = action.payload;
      state.error = null;
    },
    loginSuccess: (state, action: PayloadAction<{ token: string; user: User }>) => {
      console.log('loginSuccess reducer called with token and user');
      localStorage.setItem('token', action.payload.token);
      state.token = action.payload.token;
      state.isAuthenticated = true;
      state.loading = false;
      state.user = action.payload.user;
      state.error = null;
    },
    registerSuccess: (state, action: PayloadAction<{ token: string; user: User }>) => {
      console.log('registerSuccess reducer called with token and user');
      localStorage.setItem('token', action.payload.token);
      state.token = action.payload.token;
      state.isAuthenticated = true;
      state.loading = false;
      state.user = action.payload.user;
      state.error = null;
    },
    authError: (state, action: PayloadAction<string>) => {
      console.log('authError reducer called with:', action.payload);
      localStorage.removeItem('token');
      state.token = null;
      state.isAuthenticated = false;
      state.loading = false;
      state.user = null;
      state.error = action.payload;
    },
    loginFail: (state, action: PayloadAction<string>) => {
      console.log('loginFail reducer called with:', action.payload);
      localStorage.removeItem('token');
      state.token = null;
      state.isAuthenticated = false;
      state.loading = false;
      state.user = null;
      state.error = action.payload;
    },
    registerFail: (state, action: PayloadAction<string>) => {
      console.log('registerFail reducer called with:', action.payload);
      localStorage.removeItem('token');
      state.token = null;
      state.isAuthenticated = false;
      state.loading = false;
      state.user = null;
      state.error = action.payload;
    },
    logout: (state) => {
      console.log('logout reducer called');
      localStorage.removeItem('token');
      state.token = null;
      state.isAuthenticated = false;
      state.loading = false;
      state.user = null;
      state.error = null;
    },
    clearErrors: (state) => {
      console.log('clearErrors reducer called');
      state.error = null;
    },
    setLoading: (state, action: PayloadAction<boolean>) => {
      console.log('setLoading reducer called with:', action.payload);
      state.loading = action.payload;
    }
  }
});

export const { 
  userLoaded, 
  loginSuccess, 
  registerSuccess, 
  authError, 
  loginFail, 
  registerFail, 
  logout, 
  clearErrors,
  setLoading
} = authSlice.actions;

export default authSlice.reducer; 