import { Request, Response } from 'express';
import { validationResult } from 'express-validator';
import dmResponsesService from './dmResponses.service';
import { Campaign, Character, StoryPost } from '../../shared/db/models';

interface AuthRequest extends Request {
  user?: any;
}

/**
 * @desc    Generate a DM response
 * @route   POST /api/campaigns/:id/dm-response
 * @access  Private
 */
export const generateDMResponse = async (req: Request, res: Response): Promise<Response> => {
  try {
    const campaignId = parseInt(req.params.id, 10);
    const { character_id, player_input } = req.body;

    // Validate request
    if (!character_id || !player_input) {
      return res.status(400).json({ error: 'Character ID and player input are required' });
    }

    // Get campaign
    const campaign = await Campaign.findByPk(campaignId);
    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    // Get character
    const character = await Character.findOne({
      where: { id: character_id, campaign_id: campaignId },
    });
    if (!character) {
      return res.status(404).json({ error: 'Character not found in this campaign' });
    }

    // Get story posts for context
    const storyPosts = await StoryPost.findAll({
      where: { campaign_id: campaignId },
      order: [['created_at', 'ASC']],
      limit: 10,
    });

    // Create context object
    const context = {
      campaign,
      character,
      storyPosts,
    };

    // Generate DM response
    const dmResponse = await dmResponsesService.generateDMResponse(player_input, context);

    // Create story post for DM response
    const storyPost = await StoryPost.create({
      content: dmResponse,
      author_type: 'system',
      campaign_id: campaignId,
    });

    return res.status(201).json(storyPost);
  } catch (error: any) {
    console.error('Error generating DM response:', error);
    return res.status(500).json({ error: 'Failed to generate DM response', message: error.message });
  }
};

/**
 * Generate a campaign introduction
 * @route POST /api/campaigns/:id/introduction
 * @param req Request
 * @param res Response
 * @returns Response with campaign introduction
 */
export const generateCampaignIntroduction = async (req: Request, res: Response): Promise<Response> => {
  try {
    const campaignId = parseInt(req.params.id, 10);

    // Get campaign
    const campaign = await Campaign.findByPk(campaignId);
    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    // Create context object
    const context = {
      campaign,
    };

    // Generate campaign introduction
    const introduction = await dmResponsesService.generateCampaignIntroduction(context);

    // Create story post for introduction
    const storyPost = await StoryPost.create({
      content: introduction,
      author_type: 'system',
      campaign_id: campaignId,
    });

    return res.status(201).json(storyPost);
  } catch (error: any) {
    console.error('Error generating campaign introduction:', error);
    return res.status(500).json({ error: 'Failed to generate campaign introduction', message: error.message });
  }
};

/**
 * Mock function to fetch game context
 * In a real implementation, this would fetch data from the database
 */
const fetchGameContext = async (userId: number, campaignId: number) => {
  // This is a mock implementation
  // In a real app, this would fetch data from the database
  return {
    campaign: {
      id: campaignId,
      name: 'The Lost Mines of Phandelver',
      description: 'A D&D adventure for characters of levels 1-5',
    },
    character: {
      id: 1,
      name: 'Thorin',
      class: 'Fighter',
      race: 'Dwarf',
      level: 3,
      stats: {
        strength: 16,
        dexterity: 12,
        constitution: 14,
        intelligence: 10,
        wisdom: 8,
        charisma: 10,
      },
      inventory: ['Longsword', 'Shield', 'Backpack', 'Rations'],
    },
    storyPosts: [
      {
        id: 1,
        author: 'DM',
        content: 'You find yourselves in the town of Phandalin, a small settlement nestled in the foothills of the Sword Mountains.',
      },
      {
        id: 2,
        author: 'Thorin',
        content: 'I want to visit the local tavern and ask about any rumors.',
      },
      {
        id: 3,
        author: 'DM',
        content: 'You enter the Stonehill Inn, a modest establishment in the center of town. The tavern is bustling with locals and a few travelers.',
      },
    ],
  };
}; 