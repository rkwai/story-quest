import { Model, DataTypes, Optional, Association } from 'sequelize';
import sequelize from '../connection';
import Character from './Character';
import CharacterItem from './CharacterItem';

// Attributes interface
interface ItemAttributes {
  id: number;
  name: string;
  description: string;
  type: 'weapon' | 'armor' | 'potion' | 'artifact' | 'misc';
  properties: object;
  campaign_id: number;
  created_at: Date;
  updated_at: Date;
}

// Creation attributes interface (optional fields during creation)
interface ItemCreationAttributes extends Optional<ItemAttributes, 'id' | 'properties' | 'created_at' | 'updated_at'> {}

class Item extends Model<ItemAttributes, ItemCreationAttributes> implements ItemAttributes {
  public id!: number;
  public name!: string;
  public description!: string;
  public type!: 'weapon' | 'armor' | 'potion' | 'artifact' | 'misc';
  public properties!: object;
  public campaign_id!: number;
  public created_at!: Date;
  public updated_at!: Date;

  // Timestamps
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  // Associations
  public readonly campaign?: any; // Changed to any to avoid circular dependency
  public readonly characters?: Character[];

  public static associations: {
    campaign: Association<Item, any>; // Changed to any
    characters: Association<Item, Character>;
  };
}

Item.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    type: {
      type: DataTypes.ENUM('weapon', 'armor', 'potion', 'artifact', 'misc'),
      allowNull: false,
    },
    properties: {
      type: DataTypes.JSON,
      allowNull: false,
      defaultValue: {},
    },
    campaign_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'campaigns',
        key: 'id',
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
    tableName: 'items',
    modelName: 'Item',
    timestamps: true,
    underscored: true,
  }
);

// Define associations in a function to be called after all models are defined
export const setupItemAssociations = () => {
  const Campaign = require('./Campaign').default;
  
  Item.belongsTo(Campaign, {
    foreignKey: 'campaign_id',
    as: 'campaign',
  });

  Item.belongsToMany(Character, {
    through: CharacterItem,
    foreignKey: 'item_id',
    otherKey: 'character_id',
    as: 'characters',
  });
};

export default Item; 