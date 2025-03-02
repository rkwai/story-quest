import express from 'express';
import { body } from 'express-validator';
import * as campaignController from '../controllers/campaignController';
import { protect } from '../middleware/authMiddleware';

const router = express.Router();

// All campaign routes require authentication
router.use(protect);

// @route   GET /api/campaigns
// @desc    Get all user's campaigns
// @access  Private
router.get('/', campaignController.getCampaigns);

// @route   POST /api/campaigns
// @desc    Create a new campaign
// @access  Private
router.post(
  '/',
  [
    body('name').trim().isLength({ min: 3, max: 100 }).withMessage('Campaign name must be between 3 and 100 characters'),
    body('description').trim().notEmpty().withMessage('Campaign description is required'),
    body('theme').trim().isLength({ min: 3, max: 50 }).withMessage('Theme must be between 3 and 50 characters'),
  ],
  campaignController.createCampaign
);

// @route   GET /api/campaigns/:id
// @desc    Get campaign by ID
// @access  Private
router.get('/:id', campaignController.getCampaign);

// @route   PUT /api/campaigns/:id
// @desc    Update campaign
// @access  Private
router.put(
  '/:id',
  [
    body('name').optional().trim().isLength({ min: 3, max: 100 }).withMessage('Campaign name must be between 3 and 100 characters'),
    body('description').optional().trim().notEmpty().withMessage('Campaign description is required'),
    body('status').optional().isIn(['active', 'completed', 'paused']).withMessage('Status must be active, completed, or paused'),
  ],
  campaignController.updateCampaign
);

// @route   DELETE /api/campaigns/:id
// @desc    Delete a campaign
// @access  Private
router.delete('/:id', campaignController.deleteCampaign);

export default router; 