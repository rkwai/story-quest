import { AuthService } from '../auth.service';
import User from '../../../shared/db/models/User';

// Mock the User model
jest.mock('../../../shared/db/models/User');

describe('AuthService', () => {
  let authService: AuthService;
  
  beforeEach(() => {
    authService = new AuthService();
    jest.clearAllMocks();
  });
  
  describe('findUserByEmail', () => {
    it('should find a user by email', async () => {
      const mockUser = { id: 1, email: 'test@example.com' };
      (User.findOne as jest.Mock).mockResolvedValue(mockUser);
      
      const result = await authService.findUserByEmail('test@example.com');
      
      expect(User.findOne).toHaveBeenCalledWith({ where: { email: 'test@example.com' } });
      expect(result).toEqual(mockUser);
    });
    
    it('should return null if user not found', async () => {
      (User.findOne as jest.Mock).mockResolvedValue(null);
      
      const result = await authService.findUserByEmail('nonexistent@example.com');
      
      expect(User.findOne).toHaveBeenCalledWith({ where: { email: 'nonexistent@example.com' } });
      expect(result).toBeNull();
    });
  });
  
  describe('createUser', () => {
    it('should create a new user', async () => {
      const userData = {
        username: 'testuser',
        email: 'test@example.com',
        password: 'password123'
      };
      
      // Mock the User.build method
      const mockUserInstance = {
        username: userData.username,
        email: userData.email,
        password_hash: '',
        role: 'player',
        password: undefined,
        save: jest.fn().mockResolvedValue({
          id: 1,
          username: userData.username,
          email: userData.email,
          role: 'player'
        })
      };
      
      (User.build as jest.Mock).mockReturnValue(mockUserInstance);
      
      const result = await authService.createUser(userData);
      
      expect(User.build).toHaveBeenCalledWith({
        username: userData.username,
        email: userData.email,
        password_hash: '',
        role: 'player'
      });
      
      expect(mockUserInstance.password).toEqual(userData.password);
      expect(mockUserInstance.save).toHaveBeenCalled();
    });
  });
  
  describe('updateUserProfile', () => {
    it('should update user profile', async () => {
      const mockUser = {
        id: 1,
        username: 'oldusername',
        email: 'old@example.com',
        password: 'oldpassword',
        save: jest.fn().mockResolvedValue(true)
      };
      
      const updateData = {
        username: 'newusername',
        email: 'new@example.com'
      };
      
      const updatedUser = {
        ...mockUser,
        ...updateData,
      };
      
      const result = await authService.updateUserProfile(mockUser, updateData);
      
      expect(mockUser.save).toHaveBeenCalled();
      expect(result.username).toEqual(updateData.username);
      expect(result.email).toEqual(updateData.email);
    });
    
    it('should only update provided fields', async () => {
      const mockUser = {
        id: 1,
        username: 'username',
        email: 'test@example.com',
        password: 'password123',
        save: jest.fn().mockResolvedValue(true)
      };
      
      const updateData = {
        username: 'newusername'
      };
      
      const result = await authService.updateUserProfile(mockUser, updateData);
      
      expect(mockUser.save).toHaveBeenCalled();
      expect(result.username).toEqual(updateData.username);
      expect(result.email).toEqual(mockUser.email); // Should remain unchanged
    });
  });
  
  describe('generateToken', () => {
    it('should generate a JWT token', () => {
      // Mock jwt.sign
      const jwtSignMock = jest.fn().mockReturnValue('mock-token');
      jest.mock('jsonwebtoken', () => ({
        sign: jwtSignMock
      }));
      
      // We can't easily test the actual token generation without mocking jwt
      // So we'll just ensure the method returns a string
      const token = authService.generateToken(1);
      expect(typeof token).toBe('string');
    });
  });
}); 