import { Request, Response } from 'express';
import { validationResult } from 'express-validator';
import * as authController from '../auth.controller';
import { AuthService } from '../auth.service';

// Define custom interface to extend Request
interface RequestWithUser extends Request {
  user?: any;
}

// Mock dependencies
jest.mock('express-validator', () => ({
  validationResult: jest.fn(),
}));

jest.mock('../auth.service');

describe('Auth Controller', () => {
  let mockRequest: Partial<RequestWithUser>;
  let mockResponse: Partial<Response>;
  let mockAuthService: jest.Mocked<AuthService>;
  
  beforeEach(() => {
    mockRequest = {
      body: {},
      user: undefined,
    };
    
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    
    // Reset mocks
    jest.clearAllMocks();
    
    // Mock validation result
    ((validationResult as unknown) as jest.Mock).mockReturnValue({
      isEmpty: jest.fn().mockReturnValue(true),
      array: jest.fn().mockReturnValue([]),
    });
  });
  
  describe('register', () => {
    it('should register a new user and return user data with token', async () => {
      // Setup
      const userData = {
        username: 'testuser',
        email: 'test@example.com',
        password: 'password123',
      };
      
      mockRequest.body = userData;
      
      const mockUser = {
        id: 1,
        username: userData.username,
        email: userData.email,
        role: 'player',
      };
      
      const mockToken = 'mock-token';
      
      // Mock service methods
      (AuthService.prototype.findUserByEmail as jest.Mock).mockResolvedValue(null);
      (AuthService.prototype.createUser as jest.Mock).mockResolvedValue(mockUser);
      (AuthService.prototype.generateToken as jest.Mock).mockReturnValue(mockToken);
      
      // Execute
      await authController.register(mockRequest as Request, mockResponse as Response);
      
      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(201);
      expect(mockResponse.json).toHaveBeenCalledWith({
        id: mockUser.id,
        username: mockUser.username,
        email: mockUser.email,
        role: mockUser.role,
        token: mockToken,
      });
    });
    
    it('should return 400 if user already exists', async () => {
      // Setup
      const userData = {
        username: 'existinguser',
        email: 'existing@example.com',
        password: 'password123',
      };
      
      mockRequest.body = userData;
      
      const existingUser = {
        id: 1,
        username: userData.username,
        email: userData.email,
      };
      
      // Mock service methods
      (AuthService.prototype.findUserByEmail as jest.Mock).mockResolvedValue(existingUser);
      
      // Execute
      await authController.register(mockRequest as Request, mockResponse as Response);
      
      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: 'User already exists' });
    });
    
    it('should return 400 if validation fails', async () => {
      // Setup
      ((validationResult as unknown) as jest.Mock).mockReturnValue({
        isEmpty: jest.fn().mockReturnValue(false),
        array: jest.fn().mockReturnValue([{ msg: 'Email is required' }]),
      });
      
      // Execute
      await authController.register(mockRequest as Request, mockResponse as Response);
      
      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({ errors: [{ msg: 'Email is required' }] });
    });
  });
  
  describe('login', () => {
    it('should login user and return user data with token', async () => {
      // Setup
      const loginData = {
        email: 'test@example.com',
        password: 'password123',
      };
      
      mockRequest.body = loginData;
      
      const mockUser = {
        id: 1,
        username: 'testuser',
        email: loginData.email,
        role: 'player',
        comparePassword: jest.fn().mockResolvedValue(true),
      };
      
      const mockToken = 'mock-token';
      
      // Mock service methods
      (AuthService.prototype.findUserByEmail as jest.Mock).mockResolvedValue(mockUser);
      (AuthService.prototype.generateToken as jest.Mock).mockReturnValue(mockToken);
      
      // Execute
      await authController.login(mockRequest as Request, mockResponse as Response);
      
      // Assert
      expect(mockResponse.json).toHaveBeenCalledWith({
        id: mockUser.id,
        username: mockUser.username,
        email: mockUser.email,
        role: mockUser.role,
        token: mockToken,
      });
    });
    
    it('should return 401 if user not found', async () => {
      // Setup
      mockRequest.body = {
        email: 'nonexistent@example.com',
        password: 'password123',
      };
      
      // Mock service methods
      (AuthService.prototype.findUserByEmail as jest.Mock).mockResolvedValue(null);
      
      // Execute
      await authController.login(mockRequest as Request, mockResponse as Response);
      
      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Invalid credentials' });
    });
    
    it('should return 401 if password is incorrect', async () => {
      // Setup
      mockRequest.body = {
        email: 'test@example.com',
        password: 'wrongpassword',
      };
      
      const mockUser = {
        id: 1,
        email: 'test@example.com',
        comparePassword: jest.fn().mockResolvedValue(false),
      };
      
      // Mock service methods
      (AuthService.prototype.findUserByEmail as jest.Mock).mockResolvedValue(mockUser);
      
      // Execute
      await authController.login(mockRequest as Request, mockResponse as Response);
      
      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Invalid credentials' });
    });
  });
  
  // Additional tests for getProfile and updateProfile would follow a similar pattern
}); 