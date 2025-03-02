import { DMResponsesService } from '../dmResponses.service';
import { ILLMService } from '../../../shared/services/llm.service';

describe('DMResponsesService', () => {
  let dmResponsesService: DMResponsesService;
  let mockLLMService: jest.Mocked<ILLMService>;
  
  beforeEach(() => {
    // Create a mock LLM service
    mockLLMService = {
      generateText: jest.fn(),
    };
    
    // Create the service with the mock LLM service
    dmResponsesService = new DMResponsesService(mockLLMService);
  });
  
  describe('generateDMResponse', () => {
    it('should generate a DM response using the LLM service', async () => {
      // Setup
      const userInput = 'I want to search the tavern for clues';
      const mockContext = {
        campaign: {
          name: 'Test Campaign',
          description: 'A test campaign',
        },
        character: {
          name: 'Test Character',
          class: 'Fighter',
          race: 'Human',
          level: 1,
          stats: { strength: 10 },
          inventory: ['Sword'],
        },
        storyPosts: [
          { author: 'DM', content: 'You are in a tavern' },
          { author: 'Player', content: 'I look around' },
        ],
      };
      
      const mockResponse = 'You search the tavern and find a hidden note under one of the tables.';
      
      // Mock the LLM service response
      mockLLMService.generateText.mockResolvedValue(mockResponse);
      
      // Execute
      const result = await dmResponsesService.generateDMResponse(userInput, mockContext);
      
      // Assert
      expect(result).toBe(mockResponse);
      expect(mockLLMService.generateText).toHaveBeenCalledTimes(1);
      
      // Check that the prompt was created correctly
      const promptArg = mockLLMService.generateText.mock.calls[0][0];
      expect(promptArg).toContain('You are the Dungeon Master');
      expect(promptArg).toContain(mockContext.campaign.name);
      expect(promptArg).toContain(mockContext.character.name);
      expect(promptArg).toContain(userInput);
      
      // Check that options were passed correctly
      const optionsArg = mockLLMService.generateText.mock.calls[0][1];
      expect(optionsArg).toHaveProperty('temperature', 0.8);
      expect(optionsArg).toHaveProperty('maxTokens', 1500);
    });
    
    it('should throw an error if LLM service fails', async () => {
      // Setup
      const userInput = 'I want to search the tavern for clues';
      const mockContext = {
        campaign: { name: 'Test Campaign', description: 'A test campaign' },
        character: { name: 'Test Character', class: 'Fighter', race: 'Human', level: 1, stats: {}, inventory: [] },
        storyPosts: [],
      };
      
      // Mock the LLM service to throw an error
      mockLLMService.generateText.mockRejectedValue(new Error('LLM service error'));
      
      // Execute and assert
      await expect(dmResponsesService.generateDMResponse(userInput, mockContext))
        .rejects.toThrow('Failed to generate DM response');
    });
  });
  
  describe('createPrompt', () => {
    it('should create a properly formatted prompt', () => {
      // Setup
      const userInput = 'I want to cast a spell';
      const mockContext = {
        campaign: {
          name: 'Magical Campaign',
          description: 'A campaign full of magic',
        },
        character: {
          name: 'Wizard',
          class: 'Mage',
          race: 'Elf',
          level: 5,
          stats: { intelligence: 18 },
          inventory: ['Spellbook', 'Wand'],
        },
        storyPosts: [
          { author: 'DM', content: 'You are in a magical forest' },
          { author: 'Player', content: 'I prepare my spellbook' },
          { author: 'DM', content: 'Your spellbook glows with arcane energy' },
        ],
      };
      
      // Use reflection to access the private method
      const createPrompt = (dmResponsesService as any).createPrompt.bind(dmResponsesService);
      
      // Execute
      const prompt = createPrompt(userInput, mockContext);
      
      // Assert
      expect(prompt).toContain('You are the Dungeon Master for a D&D-inspired RPG game called StoryQuest');
      expect(prompt).toContain(`Campaign: ${mockContext.campaign.name}`);
      expect(prompt).toContain(`Campaign Description: ${mockContext.campaign.description}`);
      expect(prompt).toContain(`Player Character: ${mockContext.character.name}`);
      expect(prompt).toContain(`Character Class: ${mockContext.character.class}`);
      expect(prompt).toContain(`Player Input: ${userInput}`);
      
      // Check that story context is included
      mockContext.storyPosts.forEach(post => {
        expect(prompt).toContain(`${post.author}: ${post.content}`);
      });
    });
    
    it('should limit story context to the last 5 posts', () => {
      // Setup
      const userInput = 'I want to move forward';
      const mockContext = {
        campaign: { name: 'Long Campaign', description: 'A long campaign' },
        character: { name: 'Character', class: 'Fighter', race: 'Human', level: 1, stats: {}, inventory: [] },
        storyPosts: Array.from({ length: 10 }, (_, i) => ({
          author: i % 2 === 0 ? 'DM' : 'Player',
          content: `Post ${i + 1}`,
        })),
      };
      
      // Use reflection to access the private method
      const createPrompt = (dmResponsesService as any).createPrompt.bind(dmResponsesService);
      
      // Execute
      const prompt = createPrompt(userInput, mockContext);
      
      // Assert - only the last 5 posts should be included
      // Check that the first 5 posts are NOT in the prompt
      for (let i = 0; i < 5; i++) {
        const postContent = `${i % 2 === 0 ? 'DM' : 'Player'}: Post ${i + 1}`;
        expect(prompt).not.toContain(postContent);
      }
      
      // Check that the last 5 posts ARE in the prompt
      for (let i = 5; i < 10; i++) {
        const postContent = `${i % 2 === 0 ? 'DM' : 'Player'}: Post ${i + 1}`;
        expect(prompt).toContain(postContent);
      }
    });
  });
}); 