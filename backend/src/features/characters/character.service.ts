import Character from '../../shared/db/models/Character';
import Campaign from '../../shared/db/models/Campaign';

export class CharacterService {
  /**
   * Create a new character
   */
  async createCharacter(characterData: any): Promise<any> {
    // Check if campaign exists
    const campaign = await Campaign.findByPk(characterData.campaign_id);
    if (!campaign) {
      throw new Error('Campaign not found');
    }
    
    // Create character
    return Character.create(characterData);
  }

  /**
   * Get a character by ID
   */
  async getCharacterById(characterId: number): Promise<any> {
    const character = await Character.findByPk(characterId);
    if (!character) {
      throw new Error('Character not found');
    }
    return character;
  }

  /**
   * Update a character
   */
  async updateCharacter(characterId: number, updateData: any): Promise<any> {
    const character = await Character.findByPk(characterId);
    if (!character) {
      throw new Error('Character not found');
    }
    
    await character.update(updateData);
    return character;
  }

  /**
   * Delete a character
   */
  async deleteCharacter(characterId: number): Promise<void> {
    const character = await Character.findByPk(characterId);
    if (!character) {
      throw new Error('Character not found');
    }
    
    await character.destroy();
  }

  /**
   * Get all characters for a campaign
   */
  async getCharactersByCampaign(campaignId: number): Promise<any[]> {
    return Character.findAll({
      where: { campaign_id: campaignId }
    });
  }
} 