import axios from 'axios';
import { OpenAILLMService, MockLLMService } from '../llm.service';

// Mock axios
jest.mock('axios');

describe('LLM Service', () => {
  describe('OpenAILLMService', () => {
    let openAIService: OpenAILLMService;
    
    beforeEach(() => {
      // Mock environment variables
      process.env.OPENAI_API_KEY = 'test-api-key';
      process.env.OPENAI_MODEL = 'gpt-4';
      
      openAIService = new OpenAILLMService();
      
      // Reset mocks
      jest.clearAllMocks();
    });
    
    it('should generate text using OpenAI API', async () => {
      // Setup
      const prompt = 'Generate a story about dragons';
      const mockResponse = {
        data: {
          choices: [
            {
              message: {
                content: 'Once upon a time, there was a mighty dragon...',
              },
            },
          ],
        },
      };
      
      (axios.post as jest.Mock).mockResolvedValue(mockResponse);
      
      // Execute
      const result = await openAIService.generateText(prompt);
      
      // Assert
      expect(axios.post).toHaveBeenCalledWith(
        'https://api.openai.com/v1/chat/completions',
        {
          model: 'gpt-4',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.7,
          max_tokens: 1000,
        },
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer test-api-key',
          },
        }
      );
      
      expect(result).toBe('Once upon a time, there was a mighty dragon...');
    });
    
    it('should use custom options when provided', async () => {
      // Setup
      const prompt = 'Generate a story about dragons';
      const options = {
        temperature: 0.5,
        maxTokens: 500,
      };
      
      const mockResponse = {
        data: {
          choices: [
            {
              message: {
                content: 'A short dragon story',
              },
            },
          ],
        },
      };
      
      (axios.post as jest.Mock).mockResolvedValue(mockResponse);
      
      // Execute
      await openAIService.generateText(prompt, options);
      
      // Assert
      expect(axios.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          temperature: options.temperature,
          max_tokens: options.maxTokens,
        }),
        expect.any(Object)
      );
    });
    
    it('should throw an error if API call fails', async () => {
      // Setup
      const prompt = 'Generate a story about dragons';
      
      (axios.post as jest.Mock).mockRejectedValue(new Error('API error'));
      
      // Execute and assert
      await expect(openAIService.generateText(prompt)).rejects.toThrow('Failed to generate text with LLM');
    });
  });
  
  describe('MockLLMService', () => {
    let mockService: MockLLMService;
    
    beforeEach(() => {
      mockService = new MockLLMService();
    });
    
    it('should return a mock response', async () => {
      // Setup
      const prompt = 'Test prompt';
      
      // Execute
      const result = await mockService.generateText(prompt);
      
      // Assert
      expect(result).toBe(`Mock response for: ${prompt}`);
    });
  });
}); 