import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export interface StoryLogEntry {
  id: number;
  campaignId: number;
  content: string;
  type: 'narrative' | 'dialogue' | 'combat' | 'decision';
  timestamp: string;
  createdAt: string;
  updatedAt: string;
}

export interface StoryLogState {
  entries: StoryLogEntry[];
  currentEntry: StoryLogEntry | null;
  loading: boolean;
  error: string | null;
}

const initialState: StoryLogState = {
  entries: [],
  currentEntry: null,
  loading: false,
  error: null
};

const storyLogSlice = createSlice({
  name: 'storyLog',
  initialState,
  reducers: {
    getEntriesStart: (state) => {
      state.loading = true;
      state.error = null;
    },
    getEntriesSuccess: (state, action: PayloadAction<StoryLogEntry[]>) => {
      state.entries = action.payload;
      state.loading = false;
    },
    getEntriesFail: (state, action: PayloadAction<string>) => {
      state.loading = false;
      state.error = action.payload;
    },
    getEntryStart: (state) => {
      state.loading = true;
      state.error = null;
    },
    getEntrySuccess: (state, action: PayloadAction<StoryLogEntry>) => {
      state.currentEntry = action.payload;
      state.loading = false;
    },
    getEntryFail: (state, action: PayloadAction<string>) => {
      state.loading = false;
      state.error = action.payload;
    },
    createEntryStart: (state) => {
      state.loading = true;
      state.error = null;
    },
    createEntrySuccess: (state, action: PayloadAction<StoryLogEntry>) => {
      state.entries.push(action.payload);
      state.currentEntry = action.payload;
      state.loading = false;
    },
    createEntryFail: (state, action: PayloadAction<string>) => {
      state.loading = false;
      state.error = action.payload;
    },
    updateEntryStart: (state) => {
      state.loading = true;
      state.error = null;
    },
    updateEntrySuccess: (state, action: PayloadAction<StoryLogEntry>) => {
      state.entries = state.entries.map(entry => 
        entry.id === action.payload.id ? action.payload : entry
      );
      state.currentEntry = action.payload;
      state.loading = false;
    },
    updateEntryFail: (state, action: PayloadAction<string>) => {
      state.loading = false;
      state.error = action.payload;
    },
    deleteEntryStart: (state) => {
      state.loading = true;
      state.error = null;
    },
    deleteEntrySuccess: (state, action: PayloadAction<number>) => {
      state.entries = state.entries.filter(entry => entry.id !== action.payload);
      state.currentEntry = null;
      state.loading = false;
    },
    deleteEntryFail: (state, action: PayloadAction<string>) => {
      state.loading = false;
      state.error = action.payload;
    },
    clearStoryLogErrors: (state) => {
      state.error = null;
    }
  }
});

export const {
  getEntriesStart,
  getEntriesSuccess,
  getEntriesFail,
  getEntryStart,
  getEntrySuccess,
  getEntryFail,
  createEntryStart,
  createEntrySuccess,
  createEntryFail,
  updateEntryStart,
  updateEntrySuccess,
  updateEntryFail,
  deleteEntryStart,
  deleteEntrySuccess,
  deleteEntryFail,
  clearStoryLogErrors
} = storyLogSlice.actions;

export default storyLogSlice.reducer; 