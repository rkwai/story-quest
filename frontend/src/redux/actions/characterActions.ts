import axios from 'axios';
import {
  getCharactersStart,
  getCharactersSuccess,
  getCharactersFail,
  getCharacterStart,
  getCharacterSuccess,
  getCharacterFail,
  createCharacterStart,
  createCharacterSuccess,
  createCharacterFail,
  updateCharacterStart,
  updateCharacterSuccess,
  updateCharacterFail,
  deleteCharacterStart,
  deleteCharacterSuccess,
  deleteCharacterFail
} from '../reducers/characterReducer';
import { AppDispatch } from '../store';

// Get all characters
export const getCharacters = () => async (dispatch: AppDispatch) => {
  dispatch(getCharactersStart());

  try {
    const res = await axios.get('/api/characters');
    dispatch(getCharactersSuccess(res.data));
  } catch (err: any) {
    const error = err.response?.data?.error || 'Failed to fetch characters';
    dispatch(getCharactersFail(error));
  }
};

// Get character by ID
export const getCharacter = (id: number) => async (dispatch: AppDispatch) => {
  dispatch(getCharacterStart());

  try {
    const res = await axios.get(`/api/characters/${id}`);
    dispatch(getCharacterSuccess(res.data));
  } catch (err: any) {
    const error = err.response?.data?.error || 'Failed to fetch character';
    dispatch(getCharacterFail(error));
  }
};

// Create new character
interface CreateCharacterData {
  name: string;
  race: string;
  class: string;
  level: number;
  strength: number;
  dexterity: number;
  constitution: number;
  intelligence: number;
  wisdom: number;
  charisma: number;
  hitPoints: number;
  maxHitPoints: number;
  background: string;
  alignment: string;
  campaignId?: number;
}

export const createCharacter = (
  formData: CreateCharacterData
) => async (dispatch: AppDispatch) => {
  dispatch(createCharacterStart());

  try {
    const res = await axios.post('/api/characters', formData);
    dispatch(createCharacterSuccess(res.data));
  } catch (err: any) {
    const error = err.response?.data?.error || 'Failed to create character';
    dispatch(createCharacterFail(error));
  }
};

// Update character
interface UpdateCharacterData {
  name?: string;
  race?: string;
  class?: string;
  level?: number;
  strength?: number;
  dexterity?: number;
  constitution?: number;
  intelligence?: number;
  wisdom?: number;
  charisma?: number;
  hitPoints?: number;
  maxHitPoints?: number;
  background?: string;
  alignment?: string;
  campaignId?: number | null;
  experience?: number;
}

export const updateCharacter = (
  id: number,
  formData: UpdateCharacterData
) => async (dispatch: AppDispatch) => {
  dispatch(updateCharacterStart());

  try {
    const res = await axios.put(`/api/characters/${id}`, formData);
    dispatch(updateCharacterSuccess(res.data));
  } catch (err: any) {
    const error = err.response?.data?.error || 'Failed to update character';
    dispatch(updateCharacterFail(error));
  }
};

// Delete character
export const deleteCharacter = (id: number) => async (dispatch: AppDispatch) => {
  dispatch(deleteCharacterStart());

  try {
    await axios.delete(`/api/characters/${id}`);
    dispatch(deleteCharacterSuccess(id));
  } catch (err: any) {
    const error = err.response?.data?.error || 'Failed to delete character';
    dispatch(deleteCharacterFail(error));
  }
}; 