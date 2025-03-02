import dotenv from 'dotenv';
import OpenAI from 'openai';

// Load environment variables
dotenv.config();

// Check for required environment variables
if (!process.env.LLM_API_KEY) {
  console.error('LLM_API_KEY is required in environment variables');
  process.exit(1);
}

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.LLM_API_KEY,
});

// Default model to use
const DEFAULT_MODEL = process.env.LLM_MODEL || 'gpt-4-turbo-preview';

// System message templates for different contexts
export const SYSTEM_MESSAGES = {
  campaignIntro: `You are a skilled Dungeon Master narrating a new adventure. 
  Craft an engaging introduction for a campaign in the following theme: {{theme}}.
  Include details about the setting, atmosphere, and a hook to draw the player in.
  Keep it under 500 words. Use rich, descriptive language to set the scene.`,
  
  dmResponse: `You are a Dungeon Master responding to a player's action in a {{theme}} campaign.
  The player character is {{characterName}}, a {{race}} {{class}} with the following backstory: {{backstory}}.
  Respond to the player's action: "{{playerAction}}"
  Your response should advance the story, be descriptive, and stay consistent with previous events.
  If appropriate, introduce challenges, NPCs, or potential items that could be important to the story.
  Keep your response under 300 words.`,
  
  itemIntroduction: `You are a Dungeon Master introducing a new item in a {{theme}} campaign.
  Create a description for an item that would fit this setting and be interesting for {{characterName}}, 
  a {{race}} {{class}}. 
  Include the item's name, physical description, and hint at any powers or significance it might have.
  Keep it under 150 words.`
};

// Configuration for OpenAI API calls
export const LLM_CONFIG = {
  openai,
  defaultModel: DEFAULT_MODEL,
  defaultTemperature: 0.7,
  defaultMaxTokens: 500,
  systemMessages: SYSTEM_MESSAGES
};

export default LLM_CONFIG; 