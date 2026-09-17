import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export interface Item {
  id: number;
  name: string;
  description: string;
  type: 'weapon' | 'armor' | 'potion' | 'scroll' | 'wondrous' | 'misc';
  rarity: 'common' | 'uncommon' | 'rare' | 'very rare' | 'legendary' | 'artifact';
  value: number;
  weight: number;
  properties: string[];
  characterId: number | null;
  campaignId: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface ItemState {
  items: Item[];
  currentItem: Item | null;
  loading: boolean;
  error: string | null;
}

const initialState: ItemState = {
  items: [],
  currentItem: null,
  loading: false,
  error: null
};

const itemSlice = createSlice({
  name: 'items',
  initialState,
  reducers: {
    getItemsStart: (state) => {
      state.loading = true;
      state.error = null;
    },
    getItemsSuccess: (state, action: PayloadAction<Item[]>) => {
      state.items = action.payload;
      state.loading = false;
    },
    getItemsFail: (state, action: PayloadAction<string>) => {
      state.loading = false;
      state.error = action.payload;
    },
    getItemStart: (state) => {
      state.loading = true;
      state.error = null;
    },
    getItemSuccess: (state, action: PayloadAction<Item>) => {
      state.currentItem = action.payload;
      state.loading = false;
    },
    getItemFail: (state, action: PayloadAction<string>) => {
      state.loading = false;
      state.error = action.payload;
    },
    createItemStart: (state) => {
      state.loading = true;
      state.error = null;
    },
    createItemSuccess: (state, action: PayloadAction<Item>) => {
      state.items.push(action.payload);
      state.currentItem = action.payload;
      state.loading = false;
    },
    createItemFail: (state, action: PayloadAction<string>) => {
      state.loading = false;
      state.error = action.payload;
    },
    updateItemStart: (state) => {
      state.loading = true;
      state.error = null;
    },
    updateItemSuccess: (state, action: PayloadAction<Item>) => {
      state.items = state.items.map(item => 
        item.id === action.payload.id ? action.payload : item
      );
      state.currentItem = action.payload;
      state.loading = false;
    },
    updateItemFail: (state, action: PayloadAction<string>) => {
      state.loading = false;
      state.error = action.payload;
    },
    deleteItemStart: (state) => {
      state.loading = true;
      state.error = null;
    },
    deleteItemSuccess: (state, action: PayloadAction<number>) => {
      state.items = state.items.filter(item => item.id !== action.payload);
      state.currentItem = null;
      state.loading = false;
    },
    deleteItemFail: (state, action: PayloadAction<string>) => {
      state.loading = false;
      state.error = action.payload;
    },
    clearItemErrors: (state) => {
      state.error = null;
    }
  }
});

export const {
  getItemsStart,
  getItemsSuccess,
  getItemsFail,
  getItemStart,
  getItemSuccess,
  getItemFail,
  createItemStart,
  createItemSuccess,
  createItemFail,
  updateItemStart,
  updateItemSuccess,
  updateItemFail,
  deleteItemStart,
  deleteItemSuccess,
  deleteItemFail,
  clearItemErrors
} = itemSlice.actions;

export default itemSlice.reducer; 