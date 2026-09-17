import { Model, DataTypes } from 'sequelize';
import sequelize from '../connection';

// Attributes interface
interface CharacterItemAttributes {
  id: number;
  character_id: number;
  item_id: number;
  quantity: number;
  equipped: boolean;
  created_at: Date;
  updated_at: Date;
}

// Creation attributes interface (optional fields during creation)
interface CharacterItemCreationAttributes {
  character_id: number;
  item_id: number;
  quantity?: number;
  equipped?: boolean;
}

class CharacterItem extends Model<CharacterItemAttributes, CharacterItemCreationAttributes> implements CharacterItemAttributes {
  public id!: number;
  public character_id!: number;
  public item_id!: number;
  public quantity!: number;
  public equipped!: boolean;
  public created_at!: Date;
  public updated_at!: Date;

  // Timestamps
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

CharacterItem.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    character_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'characters',
        key: 'id',
      },
    },
    item_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'items',
        key: 'id',
      },
    },
    quantity: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
    },
    equipped: {
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
    tableName: 'character_items',
    modelName: 'CharacterItem',
    timestamps: true,
    underscored: true,
  }
);

export default CharacterItem; 