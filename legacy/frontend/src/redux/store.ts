import { configureStore } from '@reduxjs/toolkit';
import authReducer from './reducers/authReducer';
import campaignReducer from './reducers/campaignReducer';
import characterReducer from './reducers/characterReducer';
import storyLogReducer from './reducers/storyLogReducer';
import itemReducer from './reducers/itemReducer';

const store = configureStore({
  reducer: {
    auth: authReducer,
    campaigns: campaignReducer,
    characters: characterReducer,
    storyLog: storyLogReducer,
    items: itemReducer
  },
  middleware: (getDefaultMiddleware) => 
    getDefaultMiddleware({
      serializableCheck: false
    })
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

export default store; 