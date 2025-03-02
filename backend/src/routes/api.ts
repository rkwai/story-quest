import express from 'express';
import userController from '../controllers/userController';
import campaignController from '../controllers/campaignController';
import characterController from '../controllers/characterController';
import storyPostController from '../controllers/storyPostController';
import itemController from '../controllers/itemController';
import dmResponseController from '../controllers/dmResponseController';
import authMiddleware from '../middleware/authMiddleware';

const router = express.Router();

// Auth routes
router.post('/auth/register', userController.register);
router.post('/auth/login', userController.login);
router.get('/auth/user', authMiddleware, userController.getUser);

// Campaign routes
router.get('/campaigns', authMiddleware, campaignController.getUserCampaigns);
router.post('/campaigns', authMiddleware, campaignController.createCampaign);
router.get('/campaigns/:id', authMiddleware, campaignController.getCampaign);
router.put('/campaigns/:id', authMiddleware, campaignController.updateCampaign);
router.delete('/campaigns/:id', authMiddleware, campaignController.deleteCampaign);

// Character routes
router.get('/campaigns/:id/characters', authMiddleware, characterController.getCampaignCharacters);
router.post('/characters', authMiddleware, characterController.createCharacter);
router.get('/characters/:id', authMiddleware, characterController.getCharacter);
router.put('/characters/:id', authMiddleware, characterController.updateCharacter);
router.delete('/characters/:id', authMiddleware, characterController.deleteCharacter);

// Story post routes
router.get('/campaigns/:id/story-posts', authMiddleware, storyPostController.getCampaignStoryPosts);
router.post('/campaigns/:id/story-posts', authMiddleware, storyPostController.createStoryPost);
router.delete('/story-posts/:id', authMiddleware, storyPostController.deleteStoryPost);

// Item routes
router.get('/characters/:id/items', authMiddleware, itemController.getCharacterItems);
router.post('/items', authMiddleware, itemController.createItem);
router.put('/items/:id', authMiddleware, itemController.updateItem);
router.delete('/items/:id', authMiddleware, itemController.deleteItem);

// DM response routes
router.post('/campaigns/:id/dm-response', authMiddleware, dmResponseController.generateResponse);
router.post('/campaigns/:id/introduction', authMiddleware, dmResponseController.generateIntroduction);

export default router; 