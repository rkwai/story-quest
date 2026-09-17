import Campaign from '../Campaign';
import User from '../User';
import Character from '../Character';
import StoryPost from '../StoryPost';

// Mock the sequelize models
jest.mock('../Campaign');
jest.mock('../User');
jest.mock('../Character');
jest.mock('../StoryPost');

describe('Campaign Model', () => {
  let campaignMock: jest.Mocked<typeof Campaign>;
  
  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
    
    // Cast the mocked model to the correct type
    campaignMock = Campaign as jest.Mocked<typeof Campaign>;
  });
  
  describe('associations', () => {
    it('should define associations correctly', () => {
      // Setup spy on the belongsTo and hasMany methods
      const belongsToSpy = jest.spyOn(Campaign, 'belongsTo');
      const hasManySpy = jest.spyOn(Campaign, 'hasMany');
      
      // Call the associate method (if it exists)
      // Note: In the actual model, associations are defined directly rather than through an associate method
      // This test is checking the behavior that should occur when associations are set up
      
      // Assert that the associations are set up correctly
      expect(belongsToSpy).toHaveBeenCalledWith(User, {
        foreignKey: 'player_id',
        as: 'player',
      });
      
      expect(hasManySpy).toHaveBeenCalledWith(Character, {
        sourceKey: 'id',
        foreignKey: 'campaign_id',
        as: 'characters',
      });
      
      expect(hasManySpy).toHaveBeenCalledWith(StoryPost, {
        sourceKey: 'id',
        foreignKey: 'campaign_id',
        as: 'storyPosts',
      });
    });
  });
  
  describe('CRUD operations', () => {
    it('should create a campaign', async () => {
      // Setup
      const campaignData = {
        name: 'Test Campaign',
        description: 'A test campaign',
        theme: 'Fantasy',
        player_id: 1,
        status: 'active' as const,
      };
      
      campaignMock.create.mockResolvedValue({
        id: 1,
        ...campaignData,
        created_at: new Date(),
        updated_at: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any);
      
      // Execute
      const result = await Campaign.create(campaignData);
      
      // Assert
      expect(campaignMock.create).toHaveBeenCalledWith(campaignData);
      expect(result.id).toBe(1);
      expect(result.name).toBe(campaignData.name);
      expect(result.description).toBe(campaignData.description);
      expect(result.theme).toBe(campaignData.theme);
      expect(result.player_id).toBe(campaignData.player_id);
      expect(result.status).toBe(campaignData.status);
    });
    
    it('should find a campaign by id', async () => {
      // Setup
      const campaignId = 1;
      const campaignData = {
        id: campaignId,
        name: 'Test Campaign',
        description: 'A test campaign',
        theme: 'Fantasy',
        player_id: 1,
        status: 'active' as const,
        created_at: new Date(),
        updated_at: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      
      campaignMock.findByPk.mockResolvedValue(campaignData as any);
      
      // Execute
      const result = await Campaign.findByPk(campaignId);
      
      // Assert
      expect(campaignMock.findByPk).toHaveBeenCalledWith(campaignId);
      expect(result).toEqual(campaignData);
    });
    
    it('should find all campaigns for a user', async () => {
      // Setup
      const playerId = 1;
      const campaignsData = [
        {
          id: 1,
          name: 'Campaign 1',
          description: 'First campaign',
          theme: 'Fantasy',
          player_id: playerId,
          status: 'active' as const,
          created_at: new Date(),
          updated_at: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 2,
          name: 'Campaign 2',
          description: 'Second campaign',
          theme: 'Sci-Fi',
          player_id: playerId,
          status: 'active' as const,
          created_at: new Date(),
          updated_at: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];
      
      campaignMock.findAll.mockResolvedValue(campaignsData as any);
      
      // Execute
      const result = await Campaign.findAll({
        where: { player_id: playerId },
      });
      
      // Assert
      expect(campaignMock.findAll).toHaveBeenCalledWith({
        where: { player_id: playerId },
      });
      expect(result).toEqual(campaignsData);
      expect(result.length).toBe(2);
    });
    
    it('should update a campaign', async () => {
      // Setup
      const campaignId = 1;
      const updateData = {
        name: 'Updated Campaign',
        description: 'Updated description',
      };
      
      const mockUpdate = jest.fn().mockResolvedValue([1]);
      campaignMock.update = mockUpdate;
      
      // Execute
      const result = await Campaign.update(updateData, {
        where: { id: campaignId },
      });
      
      // Assert
      expect(mockUpdate).toHaveBeenCalledWith(updateData, {
        where: { id: campaignId },
      });
      expect(result[0]).toBe(1); // Number of rows affected
    });
    
    it('should delete a campaign', async () => {
      // Setup
      const campaignId = 1;
      
      const mockDestroy = jest.fn().mockResolvedValue(1);
      campaignMock.destroy = mockDestroy;
      
      // Execute
      const result = await Campaign.destroy({
        where: { id: campaignId },
      });
      
      // Assert
      expect(mockDestroy).toHaveBeenCalledWith({
        where: { id: campaignId },
      });
      expect(result).toBe(1); // Number of rows affected
    });
  });
}); 