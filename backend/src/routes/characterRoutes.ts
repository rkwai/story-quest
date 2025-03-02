import express from 'express';
import { body } from 'express-validator';
import * as characterController from '../controllers/characterController';
import { protect } from '../middleware/authMiddleware';

const router = express.Router();

// All character routes require authentication
router.use(protect);

// @route   GET /api/characters
// @desc    Get all characters
// @access  Private
router.get('/', characterController.getCharacters);

// @route   POST /api/characters
// @desc    Create a new character
// @access  Private
router.post(
  '/',
  [
    body('name').trim().isLength({ min: 2, max: 100 }).withMessage('Character name must be between 2 and 100 characters'),
    body('race').trim().notEmpty().withMessage('Race is required'),
    body('class').trim().notEmpty().withMessage('Class is required'),
    body('backstory').trim().notEmpty().withMessage('Backstory is required'),
    body('campaign_id').isNumeric().withMessage('Campaign ID must be a number'),
    body('stats').isObject().withMessage('Stats must be an object'),
  ],
  characterController.createCharacter
);

// @route   GET /api/characters/:id
// @desc    Get character by ID
// @access  Private
router.get('/:id', characterController.getCharacter);

// @route   PUT /api/characters/:id
// @desc    Update character
// @access  Private
router.put(
  '/:id',
  [
    body('name').optional().trim().isLength({ min: 2, max: 100 }).withMessage('Character name must be between 2 and 100 characters'),
    body('race').optional().trim().notEmpty().withMessage('Race is required'),
    body('class').optional().trim().notEmpty().withMessage('Class is required'),
    body('backstory').optional().trim().notEmpty().withMessage('Backstory is required'),
    body('stats').optional().isObject().withMessage('Stats must be an object'),
  ],
  characterController.updateCharacter
);

// @route   DELETE /api/characters/:id
// @desc    Delete a character
// @access  Private
router.delete('/:id', characterController.deleteCharacter);

export default router; 