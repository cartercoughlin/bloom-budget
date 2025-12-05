import { User as PrismaUser } from '@prisma/client';
import bcrypt from 'bcrypt';

export interface CreateUserInput {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}

export interface UserResponse {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  createdAt: Date;
  updatedAt: Date;
}

export class UserModel {
  /**
   * Validate email format
   */
  static validateEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Validate password strength
   * Requirements: At least 8 characters, 1 uppercase, 1 lowercase, 1 number
   */
  static validatePassword(password: string): { valid: boolean; message?: string } {
    if (password.length < 8) {
      return { valid: false, message: 'Password must be at least 8 characters long' };
    }
    if (!/[A-Z]/.test(password)) {
      return { valid: false, message: 'Password must contain at least one uppercase letter' };
    }
    if (!/[a-z]/.test(password)) {
      return { valid: false, message: 'Password must contain at least one lowercase letter' };
    }
    if (!/[0-9]/.test(password)) {
      return { valid: false, message: 'Password must contain at least one number' };
    }
    return { valid: true };
  }

  /**
   * Validate user input for creation
   */
  static validateCreateInput(input: CreateUserInput): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!input.email || !this.validateEmail(input.email)) {
      errors.push('Invalid email address');
    }

    const passwordValidation = this.validatePassword(input.password);
    if (!passwordValidation.valid) {
      errors.push(passwordValidation.message!);
    }

    if (!input.firstName || input.firstName.trim().length === 0) {
      errors.push('First name is required');
    }

    if (!input.lastName || input.lastName.trim().length === 0) {
      errors.push('Last name is required');
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Hash password using bcrypt
   */
  static async hashPassword(password: string): Promise<string> {
    const saltRounds = 12;
    return bcrypt.hash(password, saltRounds);
  }

  /**
   * Compare password with hash
   */
  static async comparePassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  /**
   * Convert Prisma user to response format (exclude sensitive data)
   */
  static toResponse(user: PrismaUser): UserResponse {
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}
