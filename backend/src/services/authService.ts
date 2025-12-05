import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { UserModel, CreateUserInput, UserResponse } from '../models/User';

const prisma = new PrismaClient();

export interface TokenPayload {
  userId: string;
  email: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export class AuthService {
  private static readonly ACCESS_TOKEN_EXPIRY = '24h';
  private static readonly REFRESH_TOKEN_EXPIRY = '30d';
  private static readonly JWT_SECRET = process.env.JWT_SECRET || '';

  /**
   * Validate JWT secret is configured
   */
  private static validateJWTSecret(): void {
    if (!this.JWT_SECRET || this.JWT_SECRET.length < 32) {
      throw new Error('JWT_SECRET must be at least 32 characters long');
    }
  }

  /**
   * Generate access token
   */
  static generateAccessToken(payload: TokenPayload): string {
    this.validateJWTSecret();
    return jwt.sign(payload, this.JWT_SECRET, {
      expiresIn: this.ACCESS_TOKEN_EXPIRY,
      issuer: 'budget-app',
      audience: 'budget-app-users',
    });
  }

  /**
   * Generate refresh token
   */
  static generateRefreshToken(payload: TokenPayload): string {
    this.validateJWTSecret();
    return jwt.sign(payload, this.JWT_SECRET, {
      expiresIn: this.REFRESH_TOKEN_EXPIRY,
      issuer: 'budget-app',
      audience: 'budget-app-users',
    });
  }

  /**
   * Generate both access and refresh tokens
   */
  static generateTokens(userId: string, email: string): AuthTokens {
    const payload: TokenPayload = { userId, email };
    return {
      accessToken: this.generateAccessToken(payload),
      refreshToken: this.generateRefreshToken(payload),
    };
  }

  /**
   * Verify and decode JWT token
   */
  static verifyToken(token: string): TokenPayload {
    this.validateJWTSecret();
    try {
      const decoded = jwt.verify(token, this.JWT_SECRET, {
        issuer: 'budget-app',
        audience: 'budget-app-users',
      }) as TokenPayload;
      return decoded;
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new Error('Token has expired');
      }
      if (error instanceof jwt.JsonWebTokenError) {
        throw new Error('Invalid token');
      }
      throw error;
    }
  }

  /**
   * Register a new user
   */
  static async register(input: CreateUserInput): Promise<{ user: UserResponse; tokens: AuthTokens }> {
    // Validate input
    const validation = UserModel.validateCreateInput(input);
    if (!validation.valid) {
      throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: input.email.toLowerCase() },
    });

    if (existingUser) {
      throw new Error('User with this email already exists');
    }

    // Hash password
    const passwordHash = await UserModel.hashPassword(input.password);

    // Create user
    const user = await prisma.user.create({
      data: {
        email: input.email.toLowerCase(),
        passwordHash,
        firstName: input.firstName.trim(),
        lastName: input.lastName.trim(),
      },
    });

    // Generate tokens
    const tokens = this.generateTokens(user.id, user.email);

    return {
      user: UserModel.toResponse(user),
      tokens,
    };
  }

  /**
   * Login user with email and password
   */
  static async login(email: string, password: string): Promise<{ user: UserResponse; tokens: AuthTokens }> {
    // Find user
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (!user) {
      throw new Error('Invalid email or password');
    }

    // Verify password
    const isPasswordValid = await UserModel.comparePassword(password, user.passwordHash);
    if (!isPasswordValid) {
      throw new Error('Invalid email or password');
    }

    // Generate tokens
    const tokens = this.generateTokens(user.id, user.email);

    return {
      user: UserModel.toResponse(user),
      tokens,
    };
  }

  /**
   * Refresh access token using refresh token
   */
  static async refreshAccessToken(refreshToken: string): Promise<AuthTokens> {
    try {
      const payload = this.verifyToken(refreshToken);

      // Verify user still exists
      const user = await prisma.user.findUnique({
        where: { id: payload.userId },
      });

      if (!user) {
        throw new Error('User not found');
      }

      // Generate new tokens
      return this.generateTokens(user.id, user.email);
    } catch (error) {
      throw new Error('Invalid refresh token');
    }
  }

  /**
   * Get user by ID
   */
  static async getUserById(userId: string): Promise<UserResponse | null> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return null;
    }

    return UserModel.toResponse(user);
  }
}
