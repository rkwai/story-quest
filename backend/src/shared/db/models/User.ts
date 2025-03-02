import { Model, DataTypes, Optional, Association } from 'sequelize';
import bcrypt from 'bcryptjs';
import sequelize from '../connection';
// Remove circular import
// import Campaign from './Campaign';

// Attributes interface
interface UserAttributes {
  id: number;
  username: string;
  email: string;
  password_hash: string;
  role: 'player' | 'admin';
  created_at: Date;
  updated_at: Date;
}

// Creation attributes interface (optional fields during creation)
interface UserCreationAttributes extends Optional<UserAttributes, 'id' | 'created_at' | 'updated_at'> {}

class User extends Model<UserAttributes, UserCreationAttributes> implements UserAttributes {
  public id!: number;
  public username!: string;
  public email!: string;
  public password_hash!: string;
  public role!: 'player' | 'admin';
  public created_at!: Date;
  public updated_at!: Date;

  // Virtuals
  public password?: string;

  // Timestamps
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  // Method to compare password
  public async comparePassword(candidatePassword: string): Promise<boolean> {
    return bcrypt.compare(candidatePassword, this.password_hash);
  }

  // Associations
  public readonly campaigns?: any[]; // Changed to any[] to avoid circular dependency

  public static associations: {
    campaigns: Association<User, any>; // Changed to any
  };

  // Add any other methods or static methods here
}

User.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    username: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: true,
      validate: {
        len: [3, 50],
      },
    },
    email: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true,
      validate: {
        isEmail: true,
      },
    },
    password_hash: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    role: {
      type: DataTypes.ENUM('player', 'admin'),
      allowNull: false,
      defaultValue: 'player',
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
    tableName: 'users',
    modelName: 'User',
    timestamps: true,
    underscored: true,
    hooks: {
      beforeCreate: async (user: User) => {
        if (user.password) {
          user.password_hash = await bcrypt.hash(user.password, 10);
        }
      },
      beforeUpdate: async (user: User) => {
        if (user.password) {
          user.password_hash = await bcrypt.hash(user.password, 10);
        }
      },
    },
  }
);

// Define associations in a function to be called after all models are defined
export const setupUserAssociations = () => {
  const Campaign = require('./Campaign').default;
  
  User.hasMany(Campaign, {
    sourceKey: 'id',
    foreignKey: 'player_id',
    as: 'campaigns',
  });
};

export default User; 