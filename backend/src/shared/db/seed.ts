import sequelize from './connection';
import { User, Campaign, Character, StoryPost, Item, CharacterItem } from './models';
import bcrypt from 'bcryptjs';

// Function to seed the database
async function seedDatabase() {
  try {
    console.log('Starting database sync...');
    
    // Force sync all models (this will drop tables if they exist)
    await sequelize.sync({ force: true });
    console.log('Database synced successfully!');

    // Create test user
    const hashedPassword = await bcrypt.hash('password123', 10);
    const testUser = await User.create({
      username: 'testuser',
      email: 'test@example.com',
      password_hash: hashedPassword,
      role: 'player'
    });
    console.log('Test user created:', testUser.username);

    // Create test campaign
    const testCampaign = await Campaign.create({
      name: 'The Lost Mines of Phandelver',
      theme: 'Fantasy',
      description: 'A classic D&D adventure for beginners',
      status: 'active',
      player_id: testUser.id
    });
    console.log('Test campaign created:', testCampaign.name);

    // Create test character
    const testCharacter = await Character.create({
      name: 'Thorin Oakenshield',
      race: 'Dwarf',
      class: 'Fighter',
      backstory: 'A dwarf warrior seeking to reclaim his homeland',
      campaign_id: testCampaign.id,
      stats: {
        strength: 16,
        dexterity: 12,
        constitution: 14,
        intelligence: 10,
        wisdom: 12,
        charisma: 8
      }
    });
    console.log('Test character created:', testCharacter.name);

    // Create test story posts
    const dmIntro = await StoryPost.create({
      content: 'Welcome to the Lost Mines of Phandelver! Your adventure begins in the small town of Phandalin, where rumors of a lost mine filled with riches have been circulating...',
      author_type: 'system',
      campaign_id: testCampaign.id
    });
    console.log('DM introduction created');

    const playerResponse = await StoryPost.create({
      content: 'Thorin approaches the tavern keeper and asks about the rumors of the lost mine.',
      author_type: 'player',
      campaign_id: testCampaign.id
    });
    console.log('Player response created');

    // Create test item
    const testItem = await Item.create({
      name: 'Dwarven Warhammer',
      description: 'A finely crafted warhammer with dwarven runes etched into the handle',
      type: 'weapon',
      properties: {
        damage: '1d10',
        weight: 10,
        value: 25
      },
      campaign_id: testCampaign.id
    });
    console.log('Test item created:', testItem.name);

    // Add item to character through CharacterItem
    await CharacterItem.create({
      character_id: testCharacter.id,
      item_id: testItem.id,
      quantity: 1,
      equipped: true
    });
    console.log('Item added to character inventory');

    console.log('Database seeded successfully!');
  } catch (error) {
    console.error('Error seeding database:', error);
  } finally {
    // Close the database connection
    await sequelize.close();
  }
}

// Run the seed function
seedDatabase(); 