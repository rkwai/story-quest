import { Model, DataTypes, Optional, Association } from 'sequelize';
import sequelize from '../connection';
// Remove circular imports
// import Campaign from './Campaign';
// import Item from './Item';
import CharacterItem from './CharacterItem';

// Attributes interface
interface CharacterAttributes {
  id: number;
  name: string;
  race: string;
  class: string;
  backstory: string;
  campaign_id: number;
  stats: {
    strength: number;
    dexterity: number;
    constitution: number;
    intelligence: number;
    wisdom: number;
    charisma: number;
  };
  created_at: Date;
  updated_at: Date;
}

// Creation attributes interface (optional fields during creation)
interface CharacterCreationAttributes extends Optional<CharacterAttributes, 'id' | 'created_at' | 'updated_at'> {}

class Character extends Model<CharacterAttributes, CharacterCreationAttributes> implements CharacterAttributes {
  public id!: number;
  public name!: string;
  public race!: string;
  public class!: string;
  public backstory!: string;
  public campaign_id!: number;
  public stats!: {
    strength: number;
    dexterity: number;
    constitution: number;
    intelligence: number;
    wisdom: number;
    charisma: number;
  };
  public created_at!: Date;
  public updated_at!: Date;

  // Timestamps
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  // Associations
  public readonly campaign?: any; // Changed to any to avoid circular dependency
  public readonly items?: any[]; // Changed to any[] to avoid circular dependency

  public static associations: {
    campaign: Association<Character, any>; // Changed to any
    items: Association<Character, any>; // Changed to any
  };

  // Add any other methods or static methods here
}

Character.init(
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
        len: [2, 100],
      },
    },
    race: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    class: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    backstory: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    campaign_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'campaigns',
        key: 'id',
      },
    },
    stats: {
      type: DataTypes.JSON,
      allowNull: false,
      defaultValue: {
        strength: 10,
        dexterity: 10,
        constitution: 10,
        intelligence: 10,
        wisdom: 10,
        charisma: 10,
      },
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
    tableName: 'characters',
    modelName: 'Character',
    timestamps: true,
    underscored: true,
  }
);

// Define associations in a function to be called after all models are defined
export const setupCharacterAssociations = () => {
  const Campaign = require('./Campaign').default;
  const Item = require('./Item').default;
  
  Character.belongsTo(Campaign, {
    foreignKey: 'campaign_id',
    as: 'campaign',
  });

  Character.belongsToMany(Item, {
    through: CharacterItem,
    foreignKey: 'character_id',
    otherKey: 'item_id',
    as: 'items',
  });
};

export default Character; 