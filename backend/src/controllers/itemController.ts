import { Request, Response } from 'express';
import { validationResult } from 'express-validator';
import Item from '../shared/db/models/Item';
import Campaign from '../shared/db/models/Campaign';
import Character from '../shared/db/models/Character';
import CharacterItem from '../shared/db/models/CharacterItem';
import { LLMService } from '../shared/services/llmService';

/**
 * Generate a new item using LLM
 * @route POST /api/items/generate
 * @access Private
 */
export const generateNewItem = async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { campaign_id, character_id } = req.body;

    // Check if campaign exists and belongs to the user
    const campaign = await Campaign.findOne({ 
      where: { 
        id: campaign_id, 
        player_id: req.user.id 
      } 
    });

    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found or you do not have access to it' });
    }

    // Check if character exists and belongs to the campaign
    const character = await Character.findOne({
      where: {
        id: character_id,
        campaign_id
      }
    });

    if (!character) {
      return res.status(404).json({ error: 'Character not found or does not belong to this campaign' });
    }

    // Generate item description using LLM
    const itemDescription = await LLMService.generateItem({
      theme: campaign.theme,
      characterName: character.name,
      race: character.race,
      characterClass: character.class
    });

    // Extract item name from the description (first line or first sentence)
    const itemName = itemDescription.split('\n')[0].replace(/[^\w\s-]/g, '').trim();

    // Create the item
    const item = await Item.create({
      name: itemName,
      description: itemDescription,
      campaign_id,
      is_equipped: false,
      properties: {}
    });

    res.status(201).json(item);
  } catch (error) {
    console.error('Error generating item:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

/**
 * Get all items for a campaign
 * @route GET /api/campaigns/:campaignId/items
 * @access Private
 */
export const getItemsByCampaign = async (req: Request, res: Response) => {
  try {
    const campaignId = parseInt(req.params.campaignId);

    // Check if campaign exists and belongs to the user
    const campaign = await Campaign.findOne({ 
      where: { 
        id: campaignId, 
        player_id: req.user.id 
      } 
    });

    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found or you do not have access to it' });
    }

    // Get items
    const items = await Item.findAll({
      where: { campaign_id: campaignId },
      order: [['created_at', 'ASC']]
    });

    res.json(items);
  } catch (error) {
    console.error('Error getting items:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

/**
 * Assign an item to a character
 * @route POST /api/characters/:characterId/items/:itemId
 * @access Private
 */
export const assignItemToCharacter = async (req: Request, res: Response) => {
  try {
    const characterId = parseInt(req.params.characterId);
    const itemId = parseInt(req.params.itemId);

    // Check if character exists and belongs to a campaign owned by the user
    const character = await Character.findOne({
      where: { id: characterId },
      include: [
        {
          model: Campaign,
          as: 'campaign',
          where: { player_id: req.user.id }
        }
      ]
    });

    if (!character) {
      return res.status(404).json({ error: 'Character not found or you do not have access to it' });
    }

    // Check if item exists and belongs to the same campaign
    const item = await Item.findOne({
      where: {
        id: itemId,
        campaign_id: character.campaign_id
      }
    });

    if (!item) {
      return res.status(404).json({ error: 'Item not found or does not belong to this campaign' });
    }

    // Check if character already has this item
    const existingAssignment = await CharacterItem.findOne({
      where: {
        character_id: characterId,
        item_id: itemId
      }
    });

    if (existingAssignment) {
      return res.status(400).json({ error: 'Character already has this item' });
    }

    // Assign item to character
    await CharacterItem.create({
      character_id: characterId,
      item_id: itemId,
      is_equipped: false
    });

    res.status(201).json({ message: 'Item assigned to character successfully' });
  } catch (error) {
    console.error('Error assigning item to character:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

/**
 * Remove an item from a character
 * @route DELETE /api/characters/:characterId/items/:itemId
 * @access Private
 */
export const removeItemFromCharacter = async (req: Request, res: Response) => {
  try {
    const characterId = parseInt(req.params.characterId);
    const itemId = parseInt(req.params.itemId);

    // Check if character exists and belongs to a campaign owned by the user
    const character = await Character.findOne({
      where: { id: characterId },
      include: [
        {
          model: Campaign,
          as: 'campaign',
          where: { player_id: req.user.id }
        }
      ]
    });

    if (!character) {
      return res.status(404).json({ error: 'Character not found or you do not have access to it' });
    }

    // Find the character-item relationship
    const characterItem = await CharacterItem.findOne({
      where: {
        character_id: characterId,
        item_id: itemId
      }
    });

    if (!characterItem) {
      return res.status(404).json({ error: 'Character does not have this item' });
    }

    // Remove the item from the character
    await characterItem.destroy();

    res.json({ message: 'Item removed from character successfully' });
  } catch (error) {
    console.error('Error removing item from character:', error);
    res.status(500).json({ error: 'Server error' });
  }
}; 