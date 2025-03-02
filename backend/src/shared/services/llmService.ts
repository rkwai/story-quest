import axios from 'axios';
import Campaign from '../db/models/Campaign';
import Character from '../db/models/Character';
import StoryPost from '../db/models/StoryPost';
import { logger } from '../utils/logger';

interface LLMResponse {
  content: string;
  tokenUsage?: {
    prompt: number;
    completion: number;
    total: number;
  };
}

interface CharacterSummary {
  name: string;
  class: string;
  level: number;
  attributes: {
    strength: number;
    dexterity: number;
    constitution: number;
    intelligence: number;
    wisdom: number;
    charisma: number;
  };
  inventory: string[];
  backstory?: string;
}

interface CampaignContext {
  campaign: {
    name: string;
    theme: string;
    description: string;
    status: string;
  };
  character: CharacterSummary;
  storyContext: string;
  recentPosts: {
    type: 'dm' | 'player';
    content: string;
  }[];
}

/**
 * Service to handle LLM interactions for the AI Dungeon Master
 */
export class LLMService {
  private apiKey: string;
  private apiUrl: string;
  private model: string;
  private maxTokens: number;
  private temperature: number;
  private maxContextTokens: number;

  constructor() {
    this.apiKey = process.env.OPENAI_API_KEY || '';
    this.apiUrl = process.env.OPENAI_API_URL || 'https://api.openai.com/v1/chat/completions';
    this.model = process.env.OPENAI_MODEL || 'gpt-4o';
    this.maxTokens = parseInt(process.env.OPENAI_MAX_TOKENS || '500');
    this.temperature = parseFloat(process.env.OPENAI_TEMPERATURE || '0.8');
    this.maxContextTokens = parseInt(process.env.OPENAI_MAX_CONTEXT_TOKENS || '4000');
    
    if (!this.apiKey) {
      throw new Error('OpenAI API key is required');
    }
  }

  /**
   * Generate a response from the AI Dungeon Master
   */
  async generateDMResponse(
    campaignId: number,
    characterId: number,
    playerInput: string
  ): Promise<LLMResponse> {
    try {
      logger.info(`Generating DM response for campaign ${campaignId} and character ${characterId}`);
      
      // Gather all necessary context
      const context = await this.buildContext(campaignId, characterId);
      
      const messages = [
        {
          role: 'system',
          content: this.buildSystemPrompt(context)
        },
        {
          role: 'user',
          content: playerInput
        }
      ];

      const response = await axios.post(
        this.apiUrl,
        {
          model: this.model,
          messages,
          max_tokens: this.maxTokens,
          temperature: this.temperature
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`
          }
        }
      );

      logger.info(`Generated DM response for campaign ${campaignId}`);

      return {
        content: response.data.choices[0].message.content,
        tokenUsage: {
          prompt: response.data.usage.prompt_tokens,
          completion: response.data.usage.completion_tokens,
          total: response.data.usage.total_tokens
        }
      };
    } catch (error) {
      logger.error('Error generating DM response:', error);
      throw new Error('Failed to generate DM response');
    }
  }

  /**
   * Build the context required for the AI to generate relevant responses
   */
  private async buildContext(
    campaignId: number,
    characterId: number
  ): Promise<CampaignContext> {
    try {
      // Fetch campaign details
      const campaign = await Campaign.findOne({ where: { id: campaignId } });
      if (!campaign) {
        throw new Error('Campaign not found');
      }

      // Fetch character details
      const character = await Character.findOne({ where: { id: characterId } });
      if (!character) {
        throw new Error('Character not found');
      }

      // Get character inventory
      const inventory = await character.getItems();

      // Fetch recent story posts (last 10)
      const recentPosts = await StoryPost.findAll({
        where: { campaign_id: campaignId },
        order: [['created_at', 'DESC']],
        limit: 10
      });

      // Build character summary
      const characterSummary: CharacterSummary = {
        name: character.name,
        class: character.class,
        level: character.level,
        attributes: character.attributes,
        inventory: inventory.map(item => item.name),
        backstory: character.backstory || undefined
      };

      // Format recent posts
      const formattedPosts = recentPosts
        .reverse()
        .map(post => ({
          type: post.type,
          content: post.content
        }));

      // Generate a story context summary based on the campaign theme and description
      const storyContext = this.generateStoryContext(campaign.theme, campaign.description);

      return {
        campaign: {
          name: campaign.name,
          theme: campaign.theme,
          description: campaign.description,
          status: campaign.status
        },
        character: characterSummary,
        storyContext,
        recentPosts: formattedPosts
      };
    } catch (error) {
      logger.error('Error building context:', error);
      throw new Error('Failed to build context for DM response');
    }
  }

  /**
   * Generate a story context based on campaign theme and description
   */
  private generateStoryContext(theme: string, description: string): string {
    const themeContexts: Record<string, string> = {
      'medieval-fantasy': 'A world of knights, wizards, dragons and ancient magic.',
      'sci-fi': 'A futuristic universe with advanced technology, space travel, and alien civilizations.',
      'post-apocalyptic': 'A devastated world recovering from a catastrophic event that nearly ended civilization.',
      'cyberpunk': 'A dystopian future where advanced technology coexists with social disorder and corporate control.',
      'steampunk': 'An alternate history where steam power remains the dominant form of technology, mixed with fantastical elements.',
      'horror': 'A dark and terrifying setting where supernatural forces threaten the characters\' survival and sanity.'
    };

    const baseContext = themeContexts[theme] || 'A world of adventure and mystery.';
    return `${baseContext} ${description}`;
  }

  /**
   * Build the system prompt for the AI Dungeon Master
   */
  private buildSystemPrompt(context: CampaignContext): string {
    const { campaign, character, storyContext, recentPosts } = context;
    
    // Format recent posts for context
    const recentConversation = recentPosts
      .map(post => {
        if (post.type === 'player') {
          return `${character.name}: ${post.content}`;
        } else {
          return `DM: ${post.content}`;
        }
      })
      .join('\n\n');

    // Format character attributes
    const attributes = Object.entries(character.attributes)
      .map(([key, value]) => `${key.charAt(0).toUpperCase() + key.slice(1)}: ${value}`)
      .join(', ');

    // Format character inventory
    const inventory = character.inventory.length > 0 
      ? character.inventory.join(', ')
      : 'No items';

    // Build the system prompt
    return `
You are an AI Dungeon Master for a role-playing game called StoryQuest.

CAMPAIGN INFORMATION:
- Name: ${campaign.name}
- Theme: ${campaign.theme}
- Status: ${campaign.status}
- Description: ${campaign.description}

PLAYER CHARACTER:
- Name: ${character.name}
- Class: ${character.class}
- Level: ${character.level}
- Attributes: ${attributes}
- Inventory: ${inventory}
${character.backstory ? `- Backstory: ${character.backstory}` : ''}

WORLD CONTEXT:
${storyContext}

RECENT CONVERSATION:
${recentConversation || 'This is the beginning of the adventure.'}

GUIDELINES FOR THE DUNGEON MASTER:
1. Adapt the story to match the campaign theme and description.
2. Consider the character's attributes, class, and level when determining outcomes.
3. Provide vivid descriptions and engage all senses in your narration.
4. Balance between narrative progression and player agency.
5. Create compelling NPCs and enemies appropriate to the setting.
6. Allow for character success based on their strengths, but maintain challenge.
7. Incorporate items from the character's inventory into the story when appropriate.
8. Play the role of all NPCs and describe environmental responses to player actions.
9. Be fair but challenging, rewarding creativity and role-playing.
10. Respond to the player's last action with appropriate consequences, descriptions, and opportunities for further interaction.

Now, respond to the player's action as a skilled and engaging Dungeon Master would, creating an immersive and responsive story experience. Your response should move the story forward and end with a situation the player can respond to.
`;
  }
}

export default new LLMService(); 