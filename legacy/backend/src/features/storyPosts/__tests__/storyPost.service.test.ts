import { StoryPostService } from '../storyPost.service';

// Mock the models before importing them
jest.mock('../../../shared/db/models/StoryPost', () => {
  return {
    __esModule: true,
    default: {
      findAll: jest.fn(),
      findByPk: jest.fn(),
      create: jest.fn()
    }
  };
});

jest.mock('../../../shared/db/models/Campaign', () => {
  return {
    __esModule: true,
    default: {
      findByPk: jest.fn(),
      hasMany: jest.fn()
    }
  };
});

// Import the mocked models
import StoryPost from '../../../shared/db/models/StoryPost';
import Campaign from '../../../shared/db/models/Campaign';

// Define the type for the story post data
interface StoryPostData {
  content: string;
  author_type: 'system' | 'player';
  campaign_id: number;
  is_resolved?: boolean;
}

describe('StoryPostService', () => {
  let storyPostService: StoryPostService;
  let mockStoryPost: jest.Mocked<typeof StoryPost>;
  let mockCampaign: jest.Mocked<typeof Campaign>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockStoryPost = StoryPost as unknown as jest.Mocked<typeof StoryPost>;
    mockCampaign = Campaign as unknown as jest.Mocked<typeof Campaign>;
    storyPostService = new StoryPostService();
  });

  describe('createStoryPost', () => {
    it('should create a story post successfully', async () => {
      // Setup
      const storyPostData: StoryPostData = {
        content: 'The party enters a dark cave...',
        author_type: 'system',
        campaign_id: 1,
      };

      const createdStoryPost = {
        id: 1,
        ...storyPostData,
        is_resolved: false,
        created_at: new Date(),
        updated_at: new Date()
      };

      // Mock campaign existence check
      mockCampaign.findByPk.mockResolvedValue({ id: 1 } as any);
      
      // Mock story post creation
      mockStoryPost.create.mockResolvedValue(createdStoryPost as any);

      // Execute
      const result = await storyPostService.createStoryPost(storyPostData);

      // Assert
      expect(mockCampaign.findByPk).toHaveBeenCalledWith(storyPostData.campaign_id);
      expect(mockStoryPost.create).toHaveBeenCalledWith(storyPostData);
      expect(result).toEqual(createdStoryPost);
    });

    it('should throw an error if campaign does not exist', async () => {
      // Setup
      const storyPostData: StoryPostData = {
        content: 'The party enters a dark cave...',
        author_type: 'system',
        campaign_id: 999, // Non-existent campaign
      };

      // Mock campaign existence check
      mockCampaign.findByPk.mockResolvedValue(null);

      // Execute & Assert
      await expect(storyPostService.createStoryPost(storyPostData))
        .rejects.toThrow('Campaign not found');
      
      expect(mockCampaign.findByPk).toHaveBeenCalledWith(storyPostData.campaign_id);
      expect(mockStoryPost.create).not.toHaveBeenCalled();
    });
  });

  describe('getStoryPostById', () => {
    it('should return a story post by id', async () => {
      // Setup
      const storyPostId = 1;
      const storyPost = {
        id: storyPostId,
        content: 'The party enters a dark cave...',
        author_type: 'system',
        campaign_id: 1,
        is_resolved: false,
        created_at: new Date(),
        updated_at: new Date()
      };

      mockStoryPost.findByPk.mockResolvedValue(storyPost as any);

      // Execute
      const result = await storyPostService.getStoryPostById(storyPostId);

      // Assert
      expect(mockStoryPost.findByPk).toHaveBeenCalledWith(storyPostId);
      expect(result).toEqual(storyPost);
    });

    it('should throw an error if story post is not found', async () => {
      // Setup
      const storyPostId = 999;
      mockStoryPost.findByPk.mockResolvedValue(null);

      // Execute & Assert
      await expect(storyPostService.getStoryPostById(storyPostId))
        .rejects.toThrow('Story post not found');
      
      expect(mockStoryPost.findByPk).toHaveBeenCalledWith(storyPostId);
    });
  });

  describe('getStoryPostsByCampaignId', () => {
    it('should return all story posts for a campaign', async () => {
      const campaignId = 1;
      const mockStoryPosts = [
        { 
          id: 1, 
          content: 'Test post 1',
          author_type: 'system',
          campaign_id: 1,
          is_resolved: false,
          created_at: new Date(),
          updated_at: new Date()
        },
        { 
          id: 2, 
          content: 'Test post 2',
          author_type: 'player',
          campaign_id: 1,
          is_resolved: false,
          created_at: new Date(),
          updated_at: new Date()
        }
      ];
      
      mockStoryPost.findAll.mockResolvedValue(mockStoryPosts as any);
      
      const result = await storyPostService.getStoryPostsByCampaignId(campaignId);
      
      expect(mockStoryPost.findAll).toHaveBeenCalledWith({
        where: { campaign_id: campaignId },
        order: [['created_at', 'ASC']]
      });
      expect(result).toEqual(mockStoryPosts);
    });
  });

  describe('updateStoryPost', () => {
    it('should update a story post successfully', async () => {
      // Setup
      const storyPostId = 1;
      const updateData = {
        content: 'Updated content'
      };

      const existingStoryPost = {
        id: storyPostId,
        content: 'Original content',
        author_type: 'system',
        campaign_id: 1,
        is_resolved: false,
        created_at: new Date(),
        updated_at: new Date(),
        update: jest.fn().mockResolvedValue([1, [{
          id: storyPostId,
          content: 'Updated content',
          author_type: 'system',
          campaign_id: 1,
          is_resolved: false,
          created_at: new Date(),
          updated_at: new Date()
        }]])
      };

      const updatedStoryPost = {
        id: storyPostId,
        content: 'Updated content',
        author_type: 'system',
        campaign_id: 1,
        is_resolved: false,
        created_at: new Date(),
        updated_at: new Date()
      };

      // First call returns the existing post, second call returns the updated post
      mockStoryPost.findByPk
        .mockResolvedValueOnce(existingStoryPost as any)
        .mockResolvedValueOnce(updatedStoryPost as any);

      // Execute
      const result = await storyPostService.updateStoryPost(storyPostId, updateData);

      // Assert
      expect(mockStoryPost.findByPk).toHaveBeenCalledTimes(2);
      expect(mockStoryPost.findByPk).toHaveBeenNthCalledWith(1, storyPostId);
      expect(mockStoryPost.findByPk).toHaveBeenNthCalledWith(2, storyPostId);
      expect(existingStoryPost.update).toHaveBeenCalledWith(updateData);
      expect(result).toEqual(expect.objectContaining({
        id: storyPostId,
        content: 'Updated content'
      }));
    });

    it('should throw an error if story post is not found', async () => {
      // Setup
      const storyPostId = 999;
      const updateData = { content: 'Updated content' };
      
      mockStoryPost.findByPk.mockResolvedValue(null);

      // Execute & Assert
      await expect(storyPostService.updateStoryPost(storyPostId, updateData))
        .rejects.toThrow('Story post not found');
      
      expect(mockStoryPost.findByPk).toHaveBeenCalledWith(storyPostId);
    });
  });

  describe('deleteStoryPost', () => {
    it('should delete a story post successfully', async () => {
      // Setup
      const storyPostId = 1;
      const mockDestroy = jest.fn().mockResolvedValue(1);
      
      const existingStoryPost = {
        id: storyPostId,
        content: 'The party enters a dark cave...',
        author_type: 'system',
        campaign_id: 1,
        is_resolved: false,
        created_at: new Date(),
        updated_at: new Date(),
        destroy: mockDestroy
      };

      mockStoryPost.findByPk.mockResolvedValue(existingStoryPost as any);

      // Execute
      await storyPostService.deleteStoryPost(storyPostId);

      // Assert
      expect(mockStoryPost.findByPk).toHaveBeenCalledWith(storyPostId);
      expect(mockDestroy).toHaveBeenCalled();
    });

    it('should throw an error if story post is not found', async () => {
      // Setup
      const storyPostId = 999;
      mockStoryPost.findByPk.mockResolvedValue(null);

      // Execute & Assert
      await expect(storyPostService.deleteStoryPost(storyPostId))
        .rejects.toThrow('Story post not found');
      
      expect(mockStoryPost.findByPk).toHaveBeenCalledWith(storyPostId);
    });
  });

  describe('getRecentStoryPosts', () => {
    it('should return recent story posts for a campaign', async () => {
      const campaignId = 1;
      const limit = 5;
      const mockStoryPosts = [
        { 
          id: 2, 
          content: 'Test post 2',
          author_type: 'player',
          campaign_id: 1,
          is_resolved: false,
          created_at: new Date(),
          updated_at: new Date()
        },
        { 
          id: 1, 
          content: 'Test post 1',
          author_type: 'system',
          campaign_id: 1,
          is_resolved: false,
          created_at: new Date(Date.now() - 86400000), // 1 day ago
          updated_at: new Date(Date.now() - 86400000)
        }
      ];
      
      mockStoryPost.findAll.mockResolvedValue(mockStoryPosts as any);
      
      const result = await storyPostService.getRecentStoryPosts(campaignId, limit);
      
      expect(mockStoryPost.findAll).toHaveBeenCalledWith({
        where: { campaign_id: campaignId },
        order: [['created_at', 'DESC']],
        limit
      });
      expect(result).toEqual(mockStoryPosts);
    });
  });
}); 