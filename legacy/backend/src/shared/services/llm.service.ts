import axios from 'axios';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

/**
 * Interface for LLM service
 */
export interface ILLMService {
  generateText(prompt: string, options?: any): Promise<string>;
}

/**
 * OpenAI LLM Service implementation
 */
export class OpenAILLMService implements ILLMService {
  private apiKey: string;
  private model: string;
  private baseUrl: string;
  private maxTokens: number;
  private temperature: number;

  constructor() {
    this.apiKey = process.env.OPENAI_API_KEY || process.env.LLM_API_KEY as string;
    this.model = process.env.OPENAI_MODEL || process.env.LLM_MODEL || 'gpt-4o';
    this.baseUrl = 'https://api.openai.com/v1/chat/completions';
    this.maxTokens = parseInt(process.env.OPENAI_MAX_TOKENS || '500');
    this.temperature = parseFloat(process.env.OPENAI_TEMPERATURE || '0.8');
    
    if (!this.apiKey) {
      throw new Error('OpenAI API key is required. Set OPENAI_API_KEY or LLM_API_KEY in .env file.');
    }
  }

  /**
   * Generate text using OpenAI API
   * @param prompt The prompt to send to the LLM
   * @param options Additional options for the API call
   * @returns Generated text
   */
  async generateText(prompt: string, options: any = {}): Promise<string> {
    try {
      const response = await axios.post(
        this.baseUrl,
        {
          model: options.model || this.model,
          messages: [{ role: 'user', content: prompt }],
          temperature: options.temperature || this.temperature,
          max_tokens: options.maxTokens || this.maxTokens,
        },
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.apiKey}`,
          },
        }
      );

      return response.data.choices[0].message.content.trim();
    } catch (error) {
      console.error('Error generating text with OpenAI:', error);
      throw new Error('Failed to generate text with LLM');
    }
  }
}

/**
 * Mock LLM Service for testing
 */
export class MockLLMService implements ILLMService {
  /**
   * Generate mock text for testing
   * @param prompt The prompt to send to the LLM
   * @returns Generated text
   */
  async generateText(prompt: string): Promise<string> {
    return `Mock response for: ${prompt}`;
  }
}

// Create and export the default LLM service instance
const llmService: ILLMService = process.env.NODE_ENV === 'test'
  ? new MockLLMService()
  : new OpenAILLMService();

export default llmService; 