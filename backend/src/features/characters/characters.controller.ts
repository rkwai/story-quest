import { Request, Response } from 'express';
import { validationResult } from 'express-validator';
import Character from '../../shared/db/models/Character';
import Campaign from '../../shared/db/models/Campaign';
import Item from '../../shared/db/models/Item';

interface AuthRequest extends Request {
  user?: any;
}

/**
 * @desc    Get all characters for the user
 * @route   GET /api/characters
 * @access  Private
 */
export const getUserCharacters = async (req: AuthRequest, res: Response) => {
  try {
    // Get characters for the logged-in user
    const characters = await Character.findAll({
      include: [
        {
          model: Campaign,
          as: 'campaign',
          where: { player_id: req.user.id },
        },
      ],
      order: [['created_at', 'DESC']],
    });

    res.json(characters);
  } catch (error) {
    console.error('Error fetching characters:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

/**
 * @desc    Create a new character
 * @route   POST /api/characters
 * @access  Private
 */
export const createCharacter = async (req: AuthRequest, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { name, class: characterClass, race, campaign_id, backstory, stats } = req.body;

  try {
    // Verify campaign exists and belongs to user
    const campaign = await Campaign.findOne({
      where: { id: campaign_id, player_id: req.user.id },
    });

    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found or not owned by user' });
    }

    // Create character
    const character = await Character.create({
      name,
      class: characterClass,
      race,
      campaign_id,
      backstory: backstory || '',
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
 * @desc    Get character by ID
 * @route   GET /api/characters/:id
 * @access  Private
 */
export const getCharacter = async (req: AuthRequest, res: Response) => {
  try {
    const character = await Character.findByPk(req.params.id, {
      include: [
        {
          model: Campaign,
          as: 'campaign',
        },
        {
          model: Item,
          as: 'items',
        },
      ],
    });

    if (!character) {
      return res.status(404).json({ error: 'Character not found' });
    }

    // Check if user owns this character's campaign
    if (character.campaign.player_id !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized to access this character' });
    }

    res.json(character);
  } catch (error) {
    console.error('Error fetching character:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

/**
 * @desc    Update character
 * @route   PUT /api/characters/:id
 * @access  Private
 */
export const updateCharacter = async (req: AuthRequest, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const character = await Character.findByPk(req.params.id, {
      include: [
        {
          model: Campaign,
          as: 'campaign',
        },
      ],
    });

    if (!character) {
      return res.status(404).json({ error: 'Character not found' });
    }

    // Check if user owns this character's campaign
    if (character.campaign.player_id !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized to modify this character' });
    }

    // Update fields
    if (req.body.name) character.name = req.body.name;
    if (req.body.class) character.class = req.body.class;
    if (req.body.race) character.race = req.body.race;
    if (req.body.backstory !== undefined) character.backstory = req.body.backstory;
    if (req.body.stats) character.stats = req.body.stats;

    await character.save();

    res.json(character);
  } catch (error) {
    console.error('Error updating character:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

/**
 * @desc    Delete a character
 * @route   DELETE /api/characters/:id
 * @access  Private
 */
export const deleteCharacter = async (req: AuthRequest, res: Response) => {
  try {
    const character = await Character.findByPk(req.params.id, {
      include: [
        {
          model: Campaign,
          as: 'campaign',
        },
      ],
    });

    if (!character) {
      return res.status(404).json({ error: 'Character not found' });
    }

    // Check if user owns this character's campaign
    if (character.campaign.player_id !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized to delete this character' });
    }

    await character.destroy();

    res.json({ message: 'Character removed' });
  } catch (error) {
    console.error('Error deleting character:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

/**
 * @desc    Get all characters for a campaign
 * @route   GET /api/campaigns/:id/characters
 * @access  Private
 */
export const getCampaignCharacters = async (req: AuthRequest, res: Response) => {
  try {
    // Verify campaign exists and belongs to user
    const campaign = await Campaign.findOne({
      where: { id: req.params.id, player_id: req.user.id },
    });

    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found or not owned by user' });
    }

    // Get characters for the campaign
    const characters = await Character.findAll({
      where: { campaign_id: req.params.id },
      include: [
        {
          model: Item,
          as: 'items',
        },
      ],
      order: [['created_at', 'DESC']],
    });

    res.json(characters);
  } catch (error) {
    console.error('Error fetching campaign characters:', error);
    res.status(500).json({ error: 'Server error' });
  }
}; 