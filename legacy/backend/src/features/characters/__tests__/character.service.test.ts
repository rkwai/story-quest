import { CharacterService } from '../character.service';
import Character from '../../../shared/db/models/Character';
import Campaign from '../../../shared/db/models/Campaign';

// Mock the models
jest.mock('../../../shared/db/models/Character');
jest.mock('../../../shared/db/models/Campaign');

describe('CharacterService', () => {
  let characterService: CharacterService;
  let mockCharacter: jest.Mocked<typeof Character>;
  let mockCampaign: jest.Mocked<typeof Campaign>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockCharacter = Character as jest.Mocked<typeof Character>;
    mockCampaign = Campaign as jest.Mocked<typeof Campaign>;
    characterService = new CharacterService();
  });

  describe('createCharacter', () => {
    it('should create a character successfully', async () => {
      // Setup
      const characterData = {
        name: 'Aragorn',
        race: 'Human',
        class: 'Ranger',
        level: 5,
        background: 'Wanderer',
        alignment: 'Chaotic Good',
        campaign_id: 1,
        stats: {
          strength: 16,
          dexterity: 14,
          constitution: 15,
          intelligence: 12,
          wisdom: 13,
          charisma: 10
        }
      };

      const createdCharacter = {
        id: 1,
        ...characterData,
        created_at: new Date(),
        updated_at: new Date()
      };

      // Mock campaign existence check
      mockCampaign.findByPk.mockResolvedValue({ id: 1 } as any);
      
      // Mock character creation
      mockCharacter.create.mockResolvedValue(createdCharacter as any);

      // Execute
      const result = await characterService.createCharacter(characterData);

      // Assert
      expect(mockCampaign.findByPk).toHaveBeenCalledWith(characterData.campaign_id);
      expect(mockCharacter.create).toHaveBeenCalledWith(characterData);
      expect(result).toEqual(createdCharacter);
    });

    it('should throw an error if campaign does not exist', async () => {
      // Setup
      const characterData = {
        name: 'Aragorn',
        race: 'Human',
        class: 'Ranger',
        campaign_id: 999, // Non-existent campaign
        stats: {
          strength: 16,
          dexterity: 14,
          constitution: 15,
          intelligence: 12,
          wisdom: 13,
          charisma: 10
        }
      };

      // Mock campaign existence check
      mockCampaign.findByPk.mockResolvedValue(null);

      // Execute & Assert
      await expect(characterService.createCharacter(characterData))
        .rejects.toThrow('Campaign not found');
      
      expect(mockCampaign.findByPk).toHaveBeenCalledWith(characterData.campaign_id);
      expect(mockCharacter.create).not.toHaveBeenCalled();
    });
  });

  describe('getCharacterById', () => {
    it('should return a character by id', async () => {
      // Setup
      const characterId = 1;
      const character = {
        id: characterId,
        name: 'Aragorn',
        race: 'Human',
        class: 'Ranger',
        level: 5,
        campaign_id: 1
      };

      mockCharacter.findByPk.mockResolvedValue(character as any);

      // Execute
      const result = await characterService.getCharacterById(characterId);

      // Assert
      expect(mockCharacter.findByPk).toHaveBeenCalledWith(characterId);
      expect(result).toEqual(character);
    });

    it('should throw an error if character is not found', async () => {
      // Setup
      const characterId = 999;
      mockCharacter.findByPk.mockResolvedValue(null);

      // Execute & Assert
      await expect(characterService.getCharacterById(characterId))
        .rejects.toThrow('Character not found');
      
      expect(mockCharacter.findByPk).toHaveBeenCalledWith(characterId);
    });
  });

  describe('updateCharacter', () => {
    it('should update a character successfully', async () => {
      // Setup
      const characterId = 1;
      const updateData = {
        level: 6,
        background: 'Updated background'
      };

      const existingCharacter = {
        id: characterId,
        name: 'Aragorn',
        level: 5,
        update: jest.fn().mockResolvedValue([1, [{ id: characterId, ...updateData }]])
      };

      mockCharacter.findByPk.mockResolvedValue(existingCharacter as any);

      // Execute
      const result = await characterService.updateCharacter(characterId, updateData);

      // Assert
      expect(mockCharacter.findByPk).toHaveBeenCalledWith(characterId);
      expect(existingCharacter.update).toHaveBeenCalledWith(updateData);
      expect(result).toEqual({ id: characterId, ...updateData });
    });

    it('should throw an error if character is not found', async () => {
      // Setup
      const characterId = 999;
      const updateData = { level: 6 };
      
      mockCharacter.findByPk.mockResolvedValue(null);

      // Execute & Assert
      await expect(characterService.updateCharacter(characterId, updateData))
        .rejects.toThrow('Character not found');
      
      expect(mockCharacter.findByPk).toHaveBeenCalledWith(characterId);
    });
  });

  describe('deleteCharacter', () => {
    it('should delete a character successfully', async () => {
      // Setup
      const characterId = 1;
      const mockDestroy = jest.fn().mockResolvedValue(1);
      
      const existingCharacter = {
        id: characterId,
        name: 'Aragorn',
        destroy: mockDestroy
      };

      mockCharacter.findByPk.mockResolvedValue(existingCharacter as any);

      // Execute
      await characterService.deleteCharacter(characterId);

      // Assert
      expect(mockCharacter.findByPk).toHaveBeenCalledWith(characterId);
      expect(mockDestroy).toHaveBeenCalled();
    });

    it('should throw an error if character is not found', async () => {
      // Setup
      const characterId = 999;
      mockCharacter.findByPk.mockResolvedValue(null);

      // Execute & Assert
      await expect(characterService.deleteCharacter(characterId))
        .rejects.toThrow('Character not found');
      
      expect(mockCharacter.findByPk).toHaveBeenCalledWith(characterId);
    });
  });

  describe('getCharactersByCampaign', () => {
    it('should return all characters for a campaign', async () => {
      // Setup
      const campaignId = 1;
      const characters = [
        { id: 1, name: 'Aragorn', campaign_id: campaignId },
        { id: 2, name: 'Legolas', campaign_id: campaignId }
      ];

      mockCharacter.findAll.mockResolvedValue(characters as any);

      // Execute
      const result = await characterService.getCharactersByCampaign(campaignId);

      // Assert
      expect(mockCharacter.findAll).toHaveBeenCalledWith({
        where: { campaign_id: campaignId }
      });
      expect(result).toEqual(characters);
      expect(result.length).toBe(2);
    });
  });
}); 