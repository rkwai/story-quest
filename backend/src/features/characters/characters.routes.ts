import express from 'express';
import { body } from 'express-validator';
import * as charactersController from './characters.controller';
import { protect } from '../../shared/middleware/authMiddleware';

const router = express.Router();

// @route   GET /api/characters
// @desc    Get all characters for the user
// @access  Private
router.get('/', protect, charactersController.getUserCharacters);

// @route   POST /api/characters
// @desc    Create a new character
// @access  Private
router.post(
  '/',
  protect,
  [
    body('name').trim().isLength({ min: 2, max: 50 }).withMessage('Character name must be between 2 and 50 characters'),
    body('class').trim().notEmpty().withMessage('Character class is required'),
    body('race').trim().notEmpty().withMessage('Character race is required'),
    body('campaign_id').isNumeric().withMessage('Campaign ID must be a number'),
    body('backstory').optional().trim(),
    body('attributes').isObject().withMessage('Attributes must be an object'),
  ],
  charactersController.createCharacter
);

// @route   GET /api/characters/:id
// @desc    Get character by ID
// @access  Private
router.get('/:id', protect, charactersController.getCharacter);

// @route   PUT /api/characters/:id
// @desc    Update character
// @access  Private
router.put(
  '/:id',
  protect,
  [
    body('name').optional().trim().isLength({ min: 2, max: 50 }).withMessage('Character name must be between 2 and 50 characters'),
    body('class').optional().trim().notEmpty().withMessage('Character class is required'),
    body('race').optional().trim().notEmpty().withMessage('Character race is required'),
    body('backstory').optional().trim(),
    body('attributes').optional().isObject().withMessage('Attributes must be an object'),
  ],
  charactersController.updateCharacter
);

// @route   DELETE /api/characters/:id
// @desc    Delete a character
// @access  Private
router.delete('/:id', protect, charactersController.deleteCharacter);

// @route   GET /api/campaigns/:id/characters
// @desc    Get all characters for a campaign
// @access  Private
router.get('/campaign/:id', protect, charactersController.getCampaignCharacters);

export default router; 