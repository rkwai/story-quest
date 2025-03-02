import express from 'express';
import { body } from 'express-validator';
import * as itemController from '../controllers/itemController';
import { protect } from '../middleware/authMiddleware';

const router = express.Router();

// All item routes require authentication
router.use(protect);

// @route   GET /api/items
// @desc    Get all items in the campaign
// @access  Private
router.get('/', itemController.getItems);

// @route   POST /api/items
// @desc    Create a new item
// @access  Private
router.post(
  '/',
  [
    body('name').trim().isLength({ min: 2, max: 100 }).withMessage('Item name must be between 2 and 100 characters'),
    body('description').trim().notEmpty().withMessage('Description is required'),
    body('type').isIn(['weapon', 'armor', 'potion', 'artifact', 'misc']).withMessage('Type must be valid'),
    body('properties').optional().isObject().withMessage('Properties must be an object'),
    body('campaign_id').isNumeric().withMessage('Campaign ID must be a number'),
  ],
  itemController.createItem
);

// @route   GET /api/items/:id
// @desc    Get item by ID
// @access  Private
router.get('/:id', itemController.getItem);

// @route   PUT /api/items/:id
// @desc    Update an item
// @access  Private
router.put(
  '/:id',
  [
    body('name').optional().trim().isLength({ min: 2, max: 100 }).withMessage('Item name must be between 2 and 100 characters'),
    body('description').optional().trim().notEmpty().withMessage('Description is required'),
    body('type').optional().isIn(['weapon', 'armor', 'potion', 'artifact', 'misc']).withMessage('Type must be valid'),
    body('properties').optional().isObject().withMessage('Properties must be an object'),
  ],
  itemController.updateItem
);

// @route   DELETE /api/items/:id
// @desc    Delete an item
// @access  Private
router.delete('/:id', itemController.deleteItem);

// @route   POST /api/items/generate
// @desc    Generate a new item using LLM
// @access  Private
router.post(
  '/generate',
  [
    body('campaign_id').isNumeric().withMessage('Campaign ID must be a number'),
    body('character_id').isNumeric().withMessage('Character ID must be a number'),
  ],
  itemController.generateItem
);

// @route   POST /api/items/:itemId/assign/:characterId
// @desc    Assign an item to a character
// @access  Private
router.post('/:itemId/assign/:characterId', itemController.assignItemToCharacter);

export default router; 