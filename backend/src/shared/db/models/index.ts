import User from './User';
import Campaign from './Campaign';
import Character from './Character';
import StoryPost from './StoryPost';
import Item from './Item';
import CharacterItem from './CharacterItem';
import { setupItemAssociations } from './Item';
import { setupCampaignItemAssociations } from './Campaign';
import { setupCharacterAssociations } from './Character';
import { setupStoryPostAssociations } from './StoryPost';
import { setupUserAssociations } from './User';

// Set up associations that might have circular dependencies
setupUserAssociations();
setupCampaignItemAssociations();
setupItemAssociations();
setupCharacterAssociations();
setupStoryPostAssociations();

export {
  User,
  Campaign,
  Character,
  StoryPost,
  Item,
  CharacterItem
}; 