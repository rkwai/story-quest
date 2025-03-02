import { Request, Response } from 'express';
import { validationResult } from 'express-validator';
import Character from '../shared/db/models/Character';
import Campaign from '../shared/db/models/Campaign';

/**
 * Create a new character for a campaign
 * @route POST /api/characters
 * @access Private
 */
export const createCharacter = async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, race, class: characterClass, backstory, campaign_id, stats } = req.body;

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

    // Create character
    const character = await Character.create({
      name,
      race,
      class: characterClass,
      backstory,
      campaign_id,
      stats: stats || {
        strength: 10,
        dexterity: 10,
        constitution: 10,
        intelligence: 10,
        wisdom: 10,
        charisma: 10,
      }
    });

    res.status(201).json(character);
  } catch (error) {
    console.error('Error creating character:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

/**
 * Get all characters for a campaign
 * @route GET /api/characters/campaign/:campaignId
 * @access Private
 */
export const getCharactersByCampaign = async (req: Request, res: Response) => {
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

    // Get characters
    const characters = await Character.findAll({
      where: { campaign_id: campaignId },
      order: [['created_at', 'ASC']]
    });

    res.json(characters);
  } catch (error) {
    console.error('Error getting characters:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

/**
 * Get a character by ID
 * @route GET /api/characters/:id
 * @access Private
 */
export const getCharacterById = async (req: Request, res: Response) => {
  try {
    const characterId = parseInt(req.params.id);

    // Get character with campaign included
    const character = await Character.findOne({
      where: { id: characterId },
      include: [
        {
          model: Campaign,
          as: 'campaign',
          where: { player_id: req.user.id } // Ensure user owns the campaign
        }
      ]
    });

    if (!character) {
      return res.status(404).json({ error: 'Character not found or you do not have access to it' });
    }

    res.json(character);
  } catch (error) {
    console.error('Error getting character:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

/**
 * Update a character
 * @route PUT /api/characters/:id
 * @access Private
 */
export const updateCharacter = async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const characterId = parseInt(req.params.id);
    const { name, race, class: characterClass, backstory, stats } = req.body;

    // Find character and ensure user owns the related campaign
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

    // Update character
    await character.update({
      name: name || character.name,
      race: race || character.race,
      class: characterClass || character.class,
      backstory: backstory || character.backstory,
      stats: stats || character.stats
    });

    res.json(character);
  } catch (error) {
    console.error('Error updating character:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

/**
 * Delete a character
 * @route DELETE /api/characters/:id
 * @access Private
 */
export const deleteCharacter = async (req: Request, res: Response) => {
  try {
    const characterId = parseInt(req.params.id);

    // Find character and ensure user owns the related campaign
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

    // Delete character
    await character.destroy();

    res.json({ message: 'Character deleted successfully' });
  } catch (error) {
    console.error('Error deleting character:', error);
    res.status(500).json({ error: 'Server error' });
  }
}; 