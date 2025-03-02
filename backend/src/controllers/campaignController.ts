import { Request, Response } from 'express';
import { validationResult } from 'express-validator';
import Campaign from '../shared/db/models/Campaign';
import StoryPost from '../shared/db/models/StoryPost';
import { LLMService } from '../shared/services/llmService';

interface AuthRequest extends Request {
  user?: any;
}

/**
 * @desc    Get all user's campaigns
 * @route   GET /api/campaigns
 * @access  Private
 */
export const getCampaigns = async (req: AuthRequest, res: Response) => {
  try {
    // Get campaigns for the logged-in user
    const campaigns = await Campaign.findAll({
      where: { player_id: req.user.id },
      order: [['created_at', 'DESC']],
    });

    res.json(campaigns);
  } catch (error) {
    console.error('Error fetching campaigns:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

/**
 * @desc    Create a new campaign
 * @route   POST /api/campaigns
 * @access  Private
 */
export const createCampaign = async (req: AuthRequest, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { name, description, theme } = req.body;

  try {
    // Create campaign
    const campaign = await Campaign.create({
      name,
      description,
      theme,
      player_id: req.user.id,
      status: 'active',
    });

    // Generate a default introduction based on the theme
    let introContent = '';
    try {
      // Try to use the dmResponsesService if available
      const dmResponsesService = require('../features/dmResponses/dmResponses.service').default;
      introContent = await dmResponsesService.generateCampaignIntroduction({ 
        campaign: { theme, name, description }
      });
    } catch (llmError) {
      console.error('Error generating campaign intro with LLM:', llmError);
      // Fallback to a default introduction if LLM fails
      const themeIntros: Record<string, string> = {
        'medieval-fantasy': 'Welcome to a world of knights, wizards, and ancient magic. Your adventure begins in a small village on the edge of a vast kingdom.',
        'sci-fi': 'In the distant future, humanity has spread across the stars. Your journey starts aboard a space station orbiting a distant planet.',
        'post-apocalyptic': 'The world as we knew it is gone. Decades after the great collapse, survivors struggle to rebuild civilization.',
        'cyberpunk': 'Neon lights illuminate the rain-slicked streets of the megacity. Corporations rule from their towering skyscrapers while hackers and street samurai navigate the shadows.',
        'steampunk': 'Gears turn and steam hisses in a world of brass and innovation. The industrial revolution has taken a fantastical turn.',
        'horror': 'A sense of dread hangs in the air. Something lurks beyond the veil of normalcy, waiting to be discovered.'
      };
      
      introContent = themeIntros[theme as string] || 'Your adventure begins. What will you do?';
    }

    // Create story post for the introduction
    await StoryPost.create({
      campaign_id: campaign.id,
      content: introContent,
      author_type: 'system',
      is_resolved: true,
    });

    res.status(201).json(campaign);
  } catch (error) {
    console.error('Error creating campaign:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

/**
 * @desc    Get campaign by ID
 * @route   GET /api/campaigns/:id
 * @access  Private
 */
export const getCampaign = async (req: AuthRequest, res: Response) => {
  try {
    const campaign = await Campaign.findByPk(req.params.id, {
      include: [
        {
          model: StoryPost,
          as: 'storyPosts',
          order: [['created_at', 'ASC']],
        },
      ],
    });

    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    // Check if user owns this campaign
    if (campaign.player_id !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized to access this campaign' });
    }

    res.json(campaign);
  } catch (error) {
    console.error('Error fetching campaign:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

/**
 * @desc    Update campaign
 * @route   PUT /api/campaigns/:id
 * @access  Private
 */
export const updateCampaign = async (req: AuthRequest, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const campaign = await Campaign.findByPk(req.params.id);

    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    // Check if user owns this campaign
    if (campaign.player_id !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized to modify this campaign' });
    }

    // Update fields
    if (req.body.name) campaign.name = req.body.name;
    if (req.body.description) campaign.description = req.body.description;
    if (req.body.status) campaign.status = req.body.status;

    await campaign.save();

    res.json(campaign);
  } catch (error) {
    console.error('Error updating campaign:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

/**
 * @desc    Delete a campaign
 * @route   DELETE /api/campaigns/:id
 * @access  Private
 */
export const deleteCampaign = async (req: AuthRequest, res: Response) => {
  try {
    const campaign = await Campaign.findByPk(req.params.id);

    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    // Check if user owns this campaign
    if (campaign.player_id !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized to delete this campaign' });
    }

    await campaign.destroy();

    res.json({ message: 'Campaign removed' });
  } catch (error) {
    console.error('Error deleting campaign:', error);
    res.status(500).json({ error: 'Server error' });
  }
}; 