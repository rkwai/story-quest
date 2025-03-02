import { Request, Response } from 'express';
import StoryPost from '../shared/db/models/StoryPost';
import Campaign from '../shared/db/models/Campaign';
import Character from '../shared/db/models/Character';
import { LLMService } from '../shared/services/llmService';

/**
 * Controller for handling DM responses
 */
class DMResponseController {
  /**
   * Generate a DM response to a player's action
   * @route POST /api/campaigns/:id/dm-response
   */
  async generateResponse(req: Request, res: Response): Promise<void> {
    try {
      const campaignId = parseInt(req.params.id);
      const { character_id, player_input } = req.body;

      if (!character_id || !player_input) {
        res.status(400).json({ error: 'Character ID and player input are required' });
        return;
      }

      // Validate that the campaign exists
      const campaign = await Campaign.findOne({ where: { id: campaignId } });
      if (!campaign) {
        res.status(404).json({ error: 'Campaign not found' });
        return;
      }

      // Validate that the character exists and belongs to the campaign
      const character = await Character.findOne({ 
        where: { 
          id: character_id,
          campaign_id: campaignId
        } 
      });
      
      if (!character) {
        res.status(404).json({ error: 'Character not found or does not belong to this campaign' });
        return;
      }

      // Generate DM response using LLM service
      const dmResponse = await LLMService.generateDMResponse(
        campaignId,
        character_id,
        player_input
      );

      // Create a new story post for the DM response
      const storyPost = await StoryPost.create({
        campaign_id: campaignId,
        character_id: character_id,
        content: dmResponse.content,
        type: 'dm'
      });

      // Return the created story post
      res.status(201).json(storyPost);
    } catch (error) {
      console.error('Error generating DM response:', error);
      res.status(500).json({ error: 'Failed to generate DM response' });
    }
  }

  /**
   * Generate a campaign introduction
   * @route POST /api/campaigns/:id/introduction
   */
  async generateIntroduction(req: Request, res: Response): Promise<void> {
    try {
      const campaignId = parseInt(req.params.id);
      const { character_id } = req.body;

      if (!character_id) {
        res.status(400).json({ error: 'Character ID is required' });
        return;
      }

      // Validate that the campaign exists
      const campaign = await Campaign.findOne({ where: { id: campaignId } });
      if (!campaign) {
        res.status(404).json({ error: 'Campaign not found' });
        return;
      }

      // Validate that the character exists and belongs to the campaign
      const character = await Character.findOne({ 
        where: { 
          id: character_id,
          campaign_id: campaignId
        } 
      });
      
      if (!character) {
        res.status(404).json({ error: 'Character not found or does not belong to this campaign' });
        return;
      }

      // Generate introduction using LLM service
      // We'll use a special prompt for the introduction
      const introductionResponse = await LLMService.generateDMResponse(
        campaignId,
        character_id,
        "I'm ready to begin the adventure. Please introduce the campaign setting and my character's initial situation."
      );

      // Create a new story post for the introduction
      const storyPost = await StoryPost.create({
        campaign_id: campaignId,
        character_id: character_id,
        content: introductionResponse.content,
        type: 'dm'
      });

      // Return the created story post
      res.status(201).json(storyPost);
    } catch (error) {
      console.error('Error generating campaign introduction:', error);
      res.status(500).json({ error: 'Failed to generate campaign introduction' });
    }
  }
}

export default new DMResponseController(); 