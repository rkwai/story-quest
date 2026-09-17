import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export interface Campaign {
  id: number;
  title: string;
  description: string;
  dungeonMasterId: number;
  createdAt: string;
  updatedAt: string;
}

export interface CampaignState {
  campaigns: Campaign[];
  currentCampaign: Campaign | null;
  loading: boolean;
  error: string | null;
}

const initialState: CampaignState = {
  campaigns: [],
  currentCampaign: null,
  loading: false,
  error: null
};

const campaignSlice = createSlice({
  name: 'campaigns',
  initialState,
  reducers: {
    getCampaignsStart: (state) => {
      state.loading = true;
      state.error = null;
    },
    getCampaignsSuccess: (state, action: PayloadAction<Campaign[]>) => {
      state.campaigns = action.payload;
      state.loading = false;
    },
    getCampaignsFail: (state, action: PayloadAction<string>) => {
      state.loading = false;
      state.error = action.payload;
    },
    getCampaignStart: (state) => {
      state.loading = true;
      state.error = null;
    },
    getCampaignSuccess: (state, action: PayloadAction<Campaign>) => {
      state.currentCampaign = action.payload;
      state.loading = false;
    },
    getCampaignFail: (state, action: PayloadAction<string>) => {
      state.loading = false;
      state.error = action.payload;
    },
    createCampaignStart: (state) => {
      state.loading = true;
      state.error = null;
    },
    createCampaignSuccess: (state, action: PayloadAction<Campaign>) => {
      state.campaigns.push(action.payload);
      state.currentCampaign = action.payload;
      state.loading = false;
    },
    createCampaignFail: (state, action: PayloadAction<string>) => {
      state.loading = false;
      state.error = action.payload;
    },
    updateCampaignStart: (state) => {
      state.loading = true;
      state.error = null;
    },
    updateCampaignSuccess: (state, action: PayloadAction<Campaign>) => {
      state.campaigns = state.campaigns.map(campaign => 
        campaign.id === action.payload.id ? action.payload : campaign
      );
      state.currentCampaign = action.payload;
      state.loading = false;
    },
    updateCampaignFail: (state, action: PayloadAction<string>) => {
      state.loading = false;
      state.error = action.payload;
    },
    deleteCampaignStart: (state) => {
      state.loading = true;
      state.error = null;
    },
    deleteCampaignSuccess: (state, action: PayloadAction<number>) => {
      state.campaigns = state.campaigns.filter(campaign => campaign.id !== action.payload);
      state.currentCampaign = null;
      state.loading = false;
    },
    deleteCampaignFail: (state, action: PayloadAction<string>) => {
      state.loading = false;
      state.error = action.payload;
    },
    clearCampaignErrors: (state) => {
      state.error = null;
    }
  }
});

export const {
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
  deleteCampaignFail,
  clearCampaignErrors
} = campaignSlice.actions;

export default campaignSlice.reducer; 