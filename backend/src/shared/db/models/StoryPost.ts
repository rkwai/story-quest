import { Model, DataTypes, Optional, Association } from 'sequelize';
import sequelize from '../connection';
// Remove circular import
// import Campaign from './Campaign';

// Attributes interface
interface StoryPostAttributes {
  id: number;
  campaign_id: number;
  content: string;
  author_type: 'system' | 'player';
  is_resolved: boolean;
  created_at: Date;
  updated_at: Date;
}

// Creation attributes interface (optional fields during creation)
interface StoryPostCreationAttributes extends Optional<StoryPostAttributes, 'id' | 'is_resolved' | 'created_at' | 'updated_at'> {}

class StoryPost extends Model<StoryPostAttributes, StoryPostCreationAttributes> implements StoryPostAttributes {
  public id!: number;
  public campaign_id!: number;
  public content!: string;
  public author_type!: 'system' | 'player';
  public is_resolved!: boolean;
  public created_at!: Date;
  public updated_at!: Date;

  // Timestamps
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  // Associations
  public readonly campaign?: any; // Changed to any to avoid circular dependency

  public static associations: {
    campaign: Association<StoryPost, any>; // Changed to any
  };
}

StoryPost.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    campaign_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'campaigns',
        key: 'id',
      },
    },
    content: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    author_type: {
      type: DataTypes.ENUM('system', 'player'),
      allowNull: false,
    },
    is_resolved: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
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
    tableName: 'story_posts',
    modelName: 'StoryPost',
    timestamps: true,
    underscored: true,
  }
);

// Define associations in a function to be called after all models are defined
export const setupStoryPostAssociations = () => {
  const Campaign = require('./Campaign').default;
  
  StoryPost.belongsTo(Campaign, {
    foreignKey: 'campaign_id',
    as: 'campaign',
  });
};

export default StoryPost; 