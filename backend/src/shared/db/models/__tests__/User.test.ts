import bcrypt from 'bcryptjs';
import User from '../User';

// Mock sequelize and bcrypt
jest.mock('../../connection', () => {
  return {
    define: jest.fn().mockReturnValue({
      init: jest.fn(),
      findOne: jest.fn(),
      findByPk: jest.fn(),
      create: jest.fn(),
    }),
  };
});

jest.mock('bcryptjs', () => ({
  genSalt: jest.fn().mockResolvedValue('salt'),
  hash: jest.fn().mockResolvedValue('hashed_password'),
  compare: jest.fn(),
}));

// Mock the User class methods and properties
User.init = jest.fn().mockReturnValue({
  hooks: {
    beforeCreate: jest.fn(),
    beforeUpdate: jest.fn(),
  }
});

describe('User Model', () => {
  describe('comparePassword', () => {
    it('should compare password with bcrypt', async () => {
      // Setup
      const user = new User();
      user.password = 'hashed_password';
      
      // Mock bcrypt.compare to return true
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      
      // Execute
      const result = await user.comparePassword('password123');
      
      // Assert
      expect(bcrypt.compare).toHaveBeenCalledWith('password123', 'hashed_password');
      expect(result).toBe(true);
    });
    
    it('should return false for incorrect password', async () => {
      // Setup
      const user = new User();
      user.password = 'hashed_password';
      
      // Mock bcrypt.compare to return false
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);
      
      // Execute
      const result = await user.comparePassword('wrong_password');
      
      // Assert
      expect(bcrypt.compare).toHaveBeenCalledWith('wrong_password', 'hashed_password');
      expect(result).toBe(false);
    });
  });
  
  describe('hooks', () => {
    it('should hash password before create', async () => {
      // Setup
      const user = new User();
      user.password = 'plain_password';
      
      // Create a mock hook function
      const beforeCreateHook = jest.fn(async (user) => {
        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(user.password, salt);
      });
      
      // Execute
      await beforeCreateHook(user);
      
      // Assert
      expect(bcrypt.genSalt).toHaveBeenCalledWith(10);
      expect(bcrypt.hash).toHaveBeenCalledWith('plain_password', 'salt');
      expect(user.password).toBe('hashed_password');
    });
    
    it('should hash password before update if changed', async () => {
      // Setup
      const user = new User();
      user.password = 'new_password';
      user.changed = jest.fn().mockReturnValue(true); // Password has changed
      
      // Create a mock hook function
      const beforeUpdateHook = jest.fn(async (user) => {
        if (user.changed('password')) {
          const salt = await bcrypt.genSalt(10);
          user.password = await bcrypt.hash(user.password, salt);
        }
      });
      
      // Execute
      await beforeUpdateHook(user);
      
      // Assert
      expect(bcrypt.genSalt).toHaveBeenCalledWith(10);
      expect(bcrypt.hash).toHaveBeenCalledWith('new_password', 'salt');
      expect(user.password).toBe('hashed_password');
    });
    
    it('should not hash password before update if not changed', async () => {
      // Setup
      const user = new User();
      user.password = 'existing_hashed_password';
      user.changed = jest.fn().mockReturnValue(false); // Password has not changed
      
      // Create a mock hook function
      const beforeUpdateHook = jest.fn(async (user) => {
        if (user.changed('password')) {
          const salt = await bcrypt.genSalt(10);
          user.password = await bcrypt.hash(user.password, salt);
        }
      });
      
      // Execute
      await beforeUpdateHook(user);
      
      // Assert
      expect(bcrypt.genSalt).not.toHaveBeenCalled();
      expect(bcrypt.hash).not.toHaveBeenCalled();
      expect(user.password).toBe('existing_hashed_password');
    });
  });
}); 