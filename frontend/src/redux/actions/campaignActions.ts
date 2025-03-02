import axios from 'axios';
import {
  getCampaignsStart,
  getCampaignsSuccess,
  getCampaignsFail,
  getCampaignStart,
  getCampaignSuccess,
  getCampaignFail,
  createCampaignStart,
  createCampaignSuccess,
  createCampaignFail,
  updateCampaignStart,
  updateCampaignSuccess,
  updateCampaignFail,
  deleteCampaignStart,
  deleteCampaignSuccess,
  deleteCampaignFail
} from '../reducers/campaignReducer';
import { AppDispatch } from '../store';

// Get all campaigns
export const getCampaigns = () => async (dispatch: AppDispatch) => {
  dispatch(getCampaignsStart());

  try {
    const res = await axios.get('/api/campaigns');
    dispatch(getCampaignsSuccess(res.data));
  } catch (err: any) {
    const error = err.response?.data?.error || 'Failed to fetch campaigns';
    dispatch(getCampaignsFail(error));
  }
};

// Get campaign by ID
export const getCampaign = (id: number) => async (dispatch: AppDispatch) => {
  dispatch(getCampaignStart());

  try {
    const res = await axios.get(`/api/campaigns/${id}`);
    dispatch(getCampaignSuccess(res.data));
  } catch (err: any) {
    const error = err.response?.data?.error || 'Failed to fetch campaign';
    dispatch(getCampaignFail(error));
  }
};

// Create new campaign
interface CreateCampaignData {
  title: string;
  description: string;
}

export const createCampaign = (
  formData: CreateCampaignData
) => async (dispatch: AppDispatch) => {
  dispatch(createCampaignStart());

  try {
    const res = await axios.post('/api/campaigns', formData);
    dispatch(createCampaignSuccess(res.data));
  } catch (err: any) {
    const error = err.response?.data?.error || 'Failed to create campaign';
    dispatch(createCampaignFail(error));
  }
};

// Update campaign
interface UpdateCampaignData {
  title?: string;
  description?: string;
}

export const updateCampaign = (
  id: number,
  formData: UpdateCampaignData
) => async (dispatch: AppDispatch) => {
  dispatch(updateCampaignStart());

  try {
    const res = await axios.put(`/api/campaigns/${id}`, formData);
    dispatch(updateCampaignSuccess(res.data));
  } catch (err: any) {
    const error = err.response?.data?.error || 'Failed to update campaign';
    dispatch(updateCampaignFail(error));
  }
};

// Delete campaign
export const deleteCampaign = (id: number) => async (dispatch: AppDispatch) => {
  dispatch(deleteCampaignStart());

  try {
    await axios.delete(`/api/campaigns/${id}`);
    dispatch(deleteCampaignSuccess(id));
  } catch (err: any) {
    const error = err.response?.data?.error || 'Failed to delete campaign';
    dispatch(deleteCampaignFail(error));
  }
}; 