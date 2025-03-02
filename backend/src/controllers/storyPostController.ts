import { Request, Response } from 'express';
import { validationResult } from 'express-validator';
import StoryPost from '../shared/db/models/StoryPost';
import Campaign from '../shared/db/models/Campaign';
import Character from '../shared/db/models/Character';
import { LLMService } from '../shared/services/llmService';

/**
 * Get all story posts for a campaign
 * @route GET /api/campaigns/:campaignId/story
 * @access Private
 */
export const getStoryPostsByCampaign = async (req: Request, res: Response) => {
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

    // Get story posts
    const storyPosts = await StoryPost.findAll({
      where: { campaign_id: campaignId },
      order: [['created_at', 'ASC']]
    });

    res.json(storyPosts);
  } catch (error) {
    console.error('Error getting story posts:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

/**
 * Create a new player post and generate DM response
 * @route POST /api/campaigns/:campaignId/story
 * @access Private
 */
export const createPlayerPost = async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const campaignId = parseInt(req.params.campaignId);
    const { content, character_id } = req.body;

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

    // Check if character exists and belongs to the campaign
    const character = await Character.findOne({
      where: {
        id: character_id,
        campaign_id: campaignId
      }
    });

    if (!character) {
      return res.status(404).json({ error: 'Character not found or does not belong to this campaign' });
    }

    // Create player post
    const playerPost = await StoryPost.create({
      campaign_id: campaignId,
      character_id,
      content,
      author_type: 'player',
    });

    // Generate DM response
    const dmResponse = await LLMService.generateDMResponse({
      theme: campaign.theme,
      characterName: character.name,
      race: character.race,
      characterClass: character.class,
      backstory: character.backstory,
      playerAction: content
    });

    // Create DM post
    const dmPost = await StoryPost.create({
      campaign_id: campaignId,
      content: dmResponse,
      author_type: 'system',
    });

    res.status(201).json({
      playerPost,
      dmPost
    });
  } catch (error) {
    console.error('Error creating story post:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

/**
 * Delete a story post
 * @route DELETE /api/campaigns/:campaignId/story/:postId
 * @access Private
 */
export const deleteStoryPost = async (req: Request, res: Response) => {
  try {
    const campaignId = parseInt(req.params.campaignId);
    const postId = parseInt(req.params.postId);

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

    // Find the post
    const post = await StoryPost.findOne({
      where: {
        id: postId,
        campaign_id: campaignId
      }
    });

    if (!post) {
      return res.status(404).json({ error: 'Story post not found' });
    }

    // Only allow deletion of player posts
    if (post.author_type !== 'player') {
      return res.status(403).json({ error: 'Only player posts can be deleted' });
    }

    // Delete the post
    await post.destroy();

    res.json({ message: 'Story post deleted successfully' });
  } catch (error) {
    console.error('Error deleting story post:', error);
    res.status(500).json({ error: 'Server error' });
  }
}; 