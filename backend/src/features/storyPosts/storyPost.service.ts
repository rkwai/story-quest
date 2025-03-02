import StoryPost from '../../shared/db/models/StoryPost';
import Campaign from '../../shared/db/models/Campaign';

// Define interfaces for the service
interface StoryPostData {
  content: string;
  author_type: 'system' | 'player';
  campaign_id: number;
  is_resolved?: boolean;
}

interface StoryPostUpdateData {
  content?: string;
  author_type?: 'system' | 'player';
  is_resolved?: boolean;
}

export class StoryPostService {
  /**
   * Create a new story post
   */
  async createStoryPost(storyPostData: StoryPostData): Promise<StoryPost> {
    // Check if campaign exists
    const campaign = await Campaign.findByPk(storyPostData.campaign_id);
    if (!campaign) {
      throw new Error('Campaign not found');
    }

    // Create the story post
    return await StoryPost.create(storyPostData);
  }

  /**
   * Get all story posts for a campaign
   */
  async getStoryPostsByCampaignId(campaignId: number): Promise<StoryPost[]> {
    return await StoryPost.findAll({
      where: { campaign_id: campaignId },
      order: [['created_at', 'ASC']]
    });
  }

  /**
   * Get a story post by ID
   */
  async getStoryPostById(id: number): Promise<StoryPost> {
    const storyPost = await StoryPost.findByPk(id);
    if (!storyPost) {
      throw new Error('Story post not found');
    }
    return storyPost;
  }

  /**
   * Update a story post
   */
  async updateStoryPost(id: number, storyPostData: StoryPostUpdateData): Promise<StoryPost> {
    const storyPost = await StoryPost.findByPk(id);
    if (!storyPost) {
      throw new Error('Story post not found');
    }
    
    await storyPost.update(storyPostData);
    
    // Return the updated story post
    return await this.getStoryPostById(id);
  }

  /**
   * Delete a story post
   */
  async deleteStoryPost(id: number): Promise<void> {
    const storyPost = await StoryPost.findByPk(id);
    if (!storyPost) {
      throw new Error('Story post not found');
    }
    
    await storyPost.destroy();
  }

  /**
   * Get recent story posts for a campaign
   */
  async getRecentStoryPosts(campaignId: number, limit: number): Promise<StoryPost[]> {
    return await StoryPost.findAll({
      where: { campaign_id: campaignId },
      order: [['created_at', 'DESC']],
      limit
    });
  }
} 