import { Model, DataTypes, Optional, Association } from 'sequelize';
import sequelize from '../connection';
import User from './User';
import Character from './Character';
import StoryPost from './StoryPost';
// Remove circular import
// import Item from './Item';

// Attributes interface
interface CampaignAttributes {
  id: number;
  name: string;
  description: string;
  player_id: number;
  theme: string;
  status: 'active' | 'completed' | 'paused';
  created_at: Date;
  updated_at: Date;
}

// Creation attributes interface (optional fields during creation)
interface CampaignCreationAttributes extends Optional<CampaignAttributes, 'id' | 'status' | 'created_at' | 'updated_at'> {}

class Campaign extends Model<CampaignAttributes, CampaignCreationAttributes> implements CampaignAttributes {
  public id!: number;
  public name!: string;
  public description!: string;
  public player_id!: number;
  public theme!: string;
  public status!: 'active' | 'completed' | 'paused';
  public created_at!: Date;
  public updated_at!: Date;

  // Timestamps
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  // Associations
  public readonly player?: User;
  public readonly characters?: Character[];
  public readonly storyPosts?: StoryPost[];
  public readonly items?: any[]; // Changed to any[] to avoid circular dependency

  public static associations: {
    player: Association<Campaign, User>;
    characters: Association<Campaign, Character>;
    storyPosts: Association<Campaign, StoryPost>;
    items: Association<Campaign, any>; // Changed to any
  };

  // Add any other methods or static methods here
}

Campaign.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING(100),
      allowNull: false,
      validate: {
        len: [3, 100],
      },
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    player_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id',
      },
    },
    theme: {
      type: DataTypes.STRING(50),
      allowNull: false,
      validate: {
        len: [3, 50],
      },
    },
    status: {
      type: DataTypes.ENUM('active', 'completed', 'paused'),
      allowNull: false,
      defaultValue: 'active',
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    updated_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    sequelize,
    tableName: 'campaigns',
    modelName: 'Campaign',
    timestamps: true,
    underscored: true,
  }
);

// Define associations for User, Character, and StoryPost
Campaign.belongsTo(User, {
  foreignKey: 'player_id',
  as: 'player',
});

Campaign.hasMany(Character, {
  sourceKey: 'id',
  foreignKey: 'campaign_id',
  as: 'characters',
});

Campaign.hasMany(StoryPost, {
  sourceKey: 'id',
  foreignKey: 'campaign_id',
  as: 'storyPosts',
});

// Define Item associations in a function to be called after all models are defined
export const setupCampaignItemAssociations = () => {
  const Item = require('./Item').default;
  
  Campaign.hasMany(Item, {
    sourceKey: 'id',
    foreignKey: 'campaign_id',
    as: 'items',
  });
};

export default Campaign; 