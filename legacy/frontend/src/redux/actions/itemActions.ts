import axios from 'axios';
import {
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
  deleteItemFail
} from '../reducers/itemReducer';
import { AppDispatch } from '../store';

// Get all items
export const getItems = () => async (dispatch: AppDispatch) => {
  dispatch(getItemsStart());

  try {
    const res = await axios.get('/api/items');
    dispatch(getItemsSuccess(res.data));
  } catch (err: any) {
    const error = err.response?.data?.error || 'Failed to fetch items';
    dispatch(getItemsFail(error));
  }
};

// Get items by character ID
export const getCharacterItems = (characterId: number) => async (dispatch: AppDispatch) => {
  dispatch(getItemsStart());

  try {
    const res = await axios.get(`/api/characters/${characterId}/items`);
    dispatch(getItemsSuccess(res.data));
  } catch (err: any) {
    const error = err.response?.data?.error || 'Failed to fetch character items';
    dispatch(getItemsFail(error));
  }
};

// Get items by campaign ID
export const getCampaignItems = (campaignId: number) => async (dispatch: AppDispatch) => {
  dispatch(getItemsStart());

  try {
    const res = await axios.get(`/api/campaigns/${campaignId}/items`);
    dispatch(getItemsSuccess(res.data));
  } catch (err: any) {
    const error = err.response?.data?.error || 'Failed to fetch campaign items';
    dispatch(getItemsFail(error));
  }
};

// Get item by ID
export const getItem = (id: number) => async (dispatch: AppDispatch) => {
  dispatch(getItemStart());

  try {
    const res = await axios.get(`/api/items/${id}`);
    dispatch(getItemSuccess(res.data));
  } catch (err: any) {
    const error = err.response?.data?.error || 'Failed to fetch item';
    dispatch(getItemFail(error));
  }
};

// Create new item
interface CreateItemData {
  name: string;
  description: string;
  type: 'weapon' | 'armor' | 'potion' | 'scroll' | 'wondrous' | 'misc';
  rarity: 'common' | 'uncommon' | 'rare' | 'very rare' | 'legendary' | 'artifact';
  value: number;
  weight: number;
  properties: string[];
  characterId?: number | null;
  campaignId?: number | null;
}

export const createItem = (
  formData: CreateItemData
) => async (dispatch: AppDispatch) => {
  dispatch(createItemStart());

  try {
    const res = await axios.post('/api/items', formData);
    dispatch(createItemSuccess(res.data));
  } catch (err: any) {
    const error = err.response?.data?.error || 'Failed to create item';
    dispatch(createItemFail(error));
  }
};

// Update item
interface UpdateItemData {
  name?: string;
  description?: string;
  type?: 'weapon' | 'armor' | 'potion' | 'scroll' | 'wondrous' | 'misc';
  rarity?: 'common' | 'uncommon' | 'rare' | 'very rare' | 'legendary' | 'artifact';
  value?: number;
  weight?: number;
  properties?: string[];
  characterId?: number | null;
  campaignId?: number | null;
}

export const updateItem = (
  id: number,
  formData: UpdateItemData
) => async (dispatch: AppDispatch) => {
  dispatch(updateItemStart());

  try {
    const res = await axios.put(`/api/items/${id}`, formData);
    dispatch(updateItemSuccess(res.data));
  } catch (err: any) {
    const error = err.response?.data?.error || 'Failed to update item';
    dispatch(updateItemFail(error));
  }
};

// Delete item
export const deleteItem = (id: number) => async (dispatch: AppDispatch) => {
  dispatch(deleteItemStart());

  try {
    await axios.delete(`/api/items/${id}`);
    dispatch(deleteItemSuccess(id));
  } catch (err: any) {
    const error = err.response?.data?.error || 'Failed to delete item';
    dispatch(deleteItemFail(error));
  }
}; 