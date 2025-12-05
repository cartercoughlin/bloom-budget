import { Category as PrismaCategory } from '@prisma/client';

export interface CreateCategoryInput {
  userId?: string;
  name: string;
  icon: string;
  color: string;
  parentCategoryId?: string;
  isSystem?: boolean;
}

export interface CategoryResponse {
  id: string;
  userId?: string;
  name: string;
  icon: string;
  color: string;
  parentCategoryId?: string;
  isSystem: boolean;
  createdAt: Date;
}

export class CategoryModel {
  /**
   * Validate color format (hex color)
   */
  static validateColor(color: string): boolean {
    const hexColorRegex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
    return hexColorRegex.test(color);
  }

  /**
   * Validate create input
   */
  static validateCreateInput(input: CreateCategoryInput): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!input.name || input.name.trim().length === 0) {
      errors.push('Category name is required');
    }

    if (!input.icon || input.icon.trim().length === 0) {
      errors.push('Category icon is required');
    }

    if (!input.color || !this.validateColor(input.color)) {
      errors.push('Valid hex color is required (e.g., #FF5733)');
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Convert Prisma Category to response format
   */
  static toResponse(category: PrismaCategory): CategoryResponse {
    return {
      id: category.id,
      userId: category.userId || undefined,
      name: category.name,
      icon: category.icon,
      color: category.color,
      parentCategoryId: category.parentCategoryId || undefined,
      isSystem: category.isSystem,
      createdAt: category.createdAt,
    };
  }
}
