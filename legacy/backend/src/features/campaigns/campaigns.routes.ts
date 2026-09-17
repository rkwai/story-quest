import express from 'express';
import { body } from 'express-validator';
import * as campaignsController from './campaigns.controller';
import { protect } from '../../shared/middleware/authMiddleware';

const router = express.Router();

// @route   GET /api/campaigns
// @desc    Get all user's campaigns
// @access  Private
router.get('/', protect, campaignsController.getUserCampaigns);

// @route   POST /api/campaigns
// @desc    Create a new campaign
// @access  Private
router.post(
  '/',
  protect,
  [
    body('name').trim().isLength({ min: 3, max: 100 }).withMessage('Campaign name must be between 3 and 100 characters'),
    body('description').trim().notEmpty().withMessage('Campaign description is required'),
    body('theme').trim().isLength({ min: 3, max: 50 }).withMessage('Theme must be between 3 and 50 characters'),
  ],
  campaignsController.createCampaign
);

// @route   GET /api/campaigns/:id
// @desc    Get campaign by ID
// @access  Private
router.get('/:id', protect, campaignsController.getCampaign);

// @route   PUT /api/campaigns/:id
// @desc    Update campaign
// @access  Private
router.put(
  '/:id',
  protect,
  [
    body('name').optional().trim().isLength({ min: 3, max: 100 }).withMessage('Campaign name must be between 3 and 100 characters'),
    body('description').optional().trim().notEmpty().withMessage('Campaign description is required'),
    body('status').optional().isIn(['active', 'completed', 'paused']).withMessage('Status must be active, completed, or paused'),
  ],
  campaignsController.updateCampaign
);

// @route   DELETE /api/campaigns/:id
// @desc    Delete a campaign
// @access  Private
router.delete('/:id', protect, campaignsController.deleteCampaign);

export default router; 