import llmService, { ILLMService } from '../../shared/services/llm.service';
import LLM_CONFIG from '../../shared/config/llmConfig';

/**
 * DM Responses Service - Handles business logic for DM responses
 */
export class DMResponsesService {
  private llmService: ILLMService;

  constructor(llmService: ILLMService) {
    this.llmService = llmService;
  }

  /**
   * Generate a DM response based on user input and context
   * @param userInput User input
   * @param context Game context
   * @returns Generated DM response
   */
  async generateDMResponse(userInput: string, context: any): Promise<string> {
    try {
      // Create a prompt with context and user input
      const prompt = this.createPrompt(userInput, context);
      
      // Generate response using LLM
      const response = await this.llmService.generateText(prompt, {
        temperature: parseFloat(process.env.OPENAI_TEMPERATURE || '0.8'),
        maxTokens: parseInt(process.env.OPENAI_MAX_TOKENS || '1500'),
      });
      
      return response;
    } catch (error) {
      console.error('Error generating DM response:', error);
      throw new Error('Failed to generate DM response');
    }
  }

  /**
   * Generate a campaign introduction
   * @param context Campaign context
   * @returns Generated introduction
   */
  async generateCampaignIntroduction(context: any): Promise<string> {
    try {
      // Get the system message template
      let systemMessage = LLM_CONFIG.systemMessages.campaignIntro;
      
      // Replace placeholders with actual values
      systemMessage = systemMessage.replace('{{theme}}', context.campaign.theme);
      
      // Generate introduction using LLM
      const response = await this.llmService.generateText(systemMessage, {
        temperature: 0.8,
        maxTokens: 1000,
      });
      
      return response;
    } catch (error) {
      console.error('Error generating campaign introduction:', error);
      throw new Error('Failed to generate campaign introduction');
    }
  }

  /**
   * Create a prompt for the LLM with context and user input
   * @param userInput User input
   * @param context Game context
   * @returns Formatted prompt
   */
  private createPrompt(userInput: string, context: any): string {
    // Extract relevant context
    const { campaign, character, storyPosts } = context;
    
    // Format story posts for context
    const storyContext = storyPosts
      .slice(-5) // Get last 5 posts for context
      .map((post: any) => `${post.author_type === 'player' ? 'Player' : 'DM'}: ${post.content}`)
      .join('\n');
    
    // Create the prompt
    return `
You are the Dungeon Master for a D&D-inspired RPG game called StoryQuest.

Campaign: ${campaign.name}
Campaign Description: ${campaign.description}
Campaign Theme: ${campaign.theme}

Player Character: ${character.name}
Character Class: ${character.class}
Character Race: ${character.race}
Character Backstory: ${character.backstory}
Character Stats: ${JSON.stringify(character.stats)}

Recent Story Context:
${storyContext}

Player Input: ${userInput}

As the Dungeon Master, provide a creative, engaging, and appropriate response to the player's input. 
Consider the campaign setting, character abilities, and recent story context.
If the player attempts an action, determine success based on their character's abilities and stats.
Keep your response immersive, descriptive, and in the style of a skilled D&D Dungeon Master.
Limit your response to 300-500 words.
`;
  }
}

// Create and export the default DM Responses service instance
const dmResponsesService = new DMResponsesService(llmService);

export default dmResponsesService; 