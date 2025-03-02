import express from 'express';
import { body } from 'express-validator';
import * as storyPostController from '../controllers/storyPostController';
import { protect } from '../middleware/authMiddleware';

const router = express.Router();

// All story post routes require authentication
router.use(protect);

// @route   GET /api/campaigns/:campaignId/story
// @desc    Get all story posts for a campaign
// @access  Private
router.get('/:campaignId/story', storyPostController.getStoryPosts);

// @route   POST /api/campaigns/:campaignId/story
// @desc    Create a new story post (player action)
// @access  Private
router.post(
  '/:campaignId/story',
  [
    body('content').trim().notEmpty().withMessage('Content is required'),
    body('author_type').optional().isIn(['player']).withMessage('Author type must be player for user posts'),
  ],
  storyPostController.createStoryPost
);

// @route   GET /api/campaigns/:campaignId/story/:id
// @desc    Get story post by ID
// @access  Private
router.get('/:campaignId/story/:id', storyPostController.getStoryPost);

// @route   PUT /api/campaigns/:campaignId/story/:id
// @desc    Update a story post
// @access  Private
router.put(
  '/:campaignId/story/:id',
  [
    body('content').trim().notEmpty().withMessage('Content is required'),
    body('is_resolved').optional().isBoolean().withMessage('Is resolved must be a boolean value'),
  ],
  storyPostController.updateStoryPost
);

// @route   DELETE /api/campaigns/:campaignId/story/:id
// @desc    Delete a story post
// @access  Private
router.delete('/:campaignId/story/:id', storyPostController.deleteStoryPost);

export default router; 