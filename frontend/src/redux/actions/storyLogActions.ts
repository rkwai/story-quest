import axios from 'axios';
import {
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
  deleteEntryFail
} from '../reducers/storyLogReducer';
import { AppDispatch } from '../store';

// Get all entries for a campaign
export const getStoryLogEntries = (campaignId: number) => async (dispatch: AppDispatch) => {
  dispatch(getEntriesStart());

  try {
    const res = await axios.get(`/api/campaigns/${campaignId}/story-log`);
    dispatch(getEntriesSuccess(res.data));
  } catch (err: any) {
    const error = err.response?.data?.error || 'Failed to fetch story log entries';
    dispatch(getEntriesFail(error));
  }
};

// Get entry by ID
export const getStoryLogEntry = (campaignId: number, entryId: number) => async (dispatch: AppDispatch) => {
  dispatch(getEntryStart());

  try {
    const res = await axios.get(`/api/campaigns/${campaignId}/story-log/${entryId}`);
    dispatch(getEntrySuccess(res.data));
  } catch (err: any) {
    const error = err.response?.data?.error || 'Failed to fetch story log entry';
    dispatch(getEntryFail(error));
  }
};

// Create new entry
interface CreateStoryLogEntryData {
  campaignId: number;
  content: string;
  type: 'narrative' | 'dialogue' | 'combat' | 'decision';
}

export const createStoryLogEntry = (
  formData: CreateStoryLogEntryData
) => async (dispatch: AppDispatch) => {
  dispatch(createEntryStart());

  try {
    const res = await axios.post(`/api/campaigns/${formData.campaignId}/story-log`, formData);
    dispatch(createEntrySuccess(res.data));
  } catch (err: any) {
    const error = err.response?.data?.error || 'Failed to create story log entry';
    dispatch(createEntryFail(error));
  }
};

// Update entry
interface UpdateStoryLogEntryData {
  content?: string;
  type?: 'narrative' | 'dialogue' | 'combat' | 'decision';
}

export const updateStoryLogEntry = (
  campaignId: number,
  entryId: number,
  formData: UpdateStoryLogEntryData
) => async (dispatch: AppDispatch) => {
  dispatch(updateEntryStart());

  try {
    const res = await axios.put(`/api/campaigns/${campaignId}/story-log/${entryId}`, formData);
    dispatch(updateEntrySuccess(res.data));
  } catch (err: any) {
    const error = err.response?.data?.error || 'Failed to update story log entry';
    dispatch(updateEntryFail(error));
  }
};

// Delete entry
export const deleteStoryLogEntry = (
  campaignId: number,
  entryId: number
) => async (dispatch: AppDispatch) => {
  dispatch(deleteEntryStart());

  try {
    await axios.delete(`/api/campaigns/${campaignId}/story-log/${entryId}`);
    dispatch(deleteEntrySuccess(entryId));
  } catch (err: any) {
    const error = err.response?.data?.error || 'Failed to delete story log entry';
    dispatch(deleteEntryFail(error));
  }
}; 