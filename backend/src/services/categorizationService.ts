import getPrismaClient from '../config/database';
import { CategorizationRuleModel } from '../models/CategorizationRule';
import { CategoryResponse } from '../models/Category';
import OpenAI from 'openai';

const prisma = getPrismaClient();

// Initialize OpenAI client if API key is available
const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

export interface CategorizationResult {
  categoryId: string;
  confidence: number;
}

export interface TransactionForCategorization {
  merchantName?: string;
  description: string;
  plaidCategory?: string[];
}

export class CategorizationService {
  /**
   * Categorize a transaction using rule matching and fallback logic
   * Requirements: 3.1, 3.2, 3.3
   */
  async categorizeTransaction(
    userId: string,
    transaction: TransactionForCategorization
  ): Promise<CategorizationResult> {
    // Step 1: Try user-specific learned rules (highest priority)
    const userRuleResult = await this.matchUserRules(userId, transaction);
    if (userRuleResult) {
      return userRuleResult;
    }

    // Step 2: Try merchant pattern matching
    const merchantResult = await this.matchMerchantPattern(userId, transaction);
    if (merchantResult) {
      return merchantResult;
    }

    // Step 3: Use Plaid category as fallback
    const plaidResult = await this.matchPlaidCategory(userId, transaction);
    if (plaidResult) {
      return plaidResult;
    }

    // Step 4: Try OpenAI categorization if available
    if (openai) {
      const aiResult = await this.categorizeWithAI(userId, transaction);
      if (aiResult) {
        return aiResult;
      }
    }

    // Step 5: Return default "Uncategorized" category with low confidence
    const defaultCategory = await this.getDefaultCategory(userId);
    return {
      categoryId: defaultCategory.id,
      confidence: 0,
    };
  }

  /**
   * Match against user-specific categorization rules
   */
  private async matchUserRules(
    userId: string,
    transaction: TransactionForCategorization
  ): Promise<CategorizationResult | null> {
    const merchantName = transaction.merchantName || transaction.description;

    // Get all user rules ordered by priority (highest first)
    const rules = await prisma.categorizationRule.findMany({
      where: { userId },
      orderBy: { priority: 'desc' },
    });

    for (const rule of rules) {
      if (CategorizationRuleModel.matchesMerchant(rule.merchantPattern, merchantName)) {
        return {
          categoryId: rule.categoryId,
          confidence: 95, // High confidence for user-learned rules
        };
      }
    }

    return null;
  }

  /**
   * Match merchant name against common patterns
   */
  private async matchMerchantPattern(
    _userId: string,
    transaction: TransactionForCategorization
  ): Promise<CategorizationResult | null> {
    const merchantInfo = transaction.merchantName || transaction.description;
    if (!merchantInfo) return null;
    
    const merchantName = merchantInfo.toLowerCase();

    // Define common merchant patterns
    const patterns = [
      // Groceries
      { pattern: /walmart|target|costco|kroger|safeway|whole foods|publix|trader joe/i, category: 'Groceries', confidence: 85 },
      
      // Gas & Fuel
      { pattern: /shell|chevron|exxon|bp|gas|fuel|marathon|speedway|circle k/i, category: 'Gas & Fuel', confidence: 85 },
      
      // Dining & Restaurants
      { pattern: /chick-fil-a|chick fil a|sonic|mcdonald|burger king|wendy|taco bell|subway|chipotle|panera/i, category: 'Dining', confidence: 90 },
      { pattern: /starbucks|coffee|cafe|dunkin|dutch bros/i, category: 'Dining', confidence: 85 },
      { pattern: /restaurant|pizza|burger|food|dining|grill|kitchen|bistro/i, category: 'Dining', confidence: 75 },
      
      // Shopping
      { pattern: /amazon|ebay|etsy|apple|one apple/i, category: 'Shopping', confidence: 80 },
      
      // Entertainment
      { pattern: /netflix|spotify|hulu|disney|apple music|youtube|hbo/i, category: 'Entertainment', confidence: 90 },
      
      // Transportation
      { pattern: /uber|lyft|taxi|transit|auto shop|service|mechanic/i, category: 'Transportation', confidence: 85 },
      
      // Utilities
      { pattern: /duke energy|piedmont|natural gas|electric|water|utility|power|energy/i, category: 'Utilities', confidence: 90 },
      
      // Bills & Payments
      { pattern: /at&t|verizon|t-mobile|sprint|comcast|xfinity|internet|phone|cable/i, category: 'Bills & Payments', confidence: 90 },
      
      // Healthcare
      { pattern: /pharmacy|cvs|walgreens|doctor|hospital|medical|health|clinic/i, category: 'Healthcare', confidence: 85 },
      
      // Health & Fitness
      { pattern: /gym|fitness|yoga|sports|planet fitness|la fitness/i, category: 'Health & Fitness', confidence: 85 },
      
      // Charity
      { pattern: /charity|donation|young life|church|nonprofit/i, category: 'Personal Care', confidence: 80 },
      
      // Financial Services
      { pattern: /betterment|vanguard|fidelity|schwab|investment|bank/i, category: 'Bills & Payments', confidence: 80 },
    ];

    for (const { pattern, category: categoryName, confidence } of patterns) {
      if (pattern.test(merchantName)) {
        // Find the category by name (system categories)
        const category = await prisma.category.findFirst({
          where: {
            name: categoryName,
            isSystem: true,
          },
        });

        if (category) {
          return {
            categoryId: category.id,
            confidence,
          };
        }
      }
    }

    return null;
  }

  /**
   * Match using Plaid's category suggestions
   */
  private async matchPlaidCategory(
    _userId: string,
    transaction: TransactionForCategorization
  ): Promise<CategorizationResult | null> {
    if (!transaction.plaidCategory || transaction.plaidCategory.length === 0) {
      return null;
    }

    // Plaid categories are hierarchical, use the most specific (last) category
    const plaidCategoryName = transaction.plaidCategory[transaction.plaidCategory.length - 1];

    // Map Plaid categories to our system categories
    const categoryMapping: Record<string, string> = {
      'Food and Drink': 'Dining',
      'Restaurants': 'Dining',
      'Groceries': 'Groceries',
      'Gas Stations': 'Gas & Fuel',
      'Transportation': 'Transportation',
      'Travel': 'Travel',
      'Entertainment': 'Entertainment',
      'Shopping': 'Shopping',
      'Healthcare': 'Healthcare',
      'Utilities': 'Utilities',
      'Rent': 'Housing',
      'Mortgage': 'Housing',
    };

    const mappedCategoryName = categoryMapping[plaidCategoryName];
    if (mappedCategoryName) {
      const category = await prisma.category.findFirst({
        where: {
          name: mappedCategoryName,
          isSystem: true,
        },
      });

      if (category) {
        return {
          categoryId: category.id,
          confidence: 70, // Medium confidence for Plaid categories
        };
      }
    }

    return null;
  }

  /**
   * Categorize using OpenAI
   */
  private async categorizeWithAI(
    userId: string,
    transaction: TransactionForCategorization
  ): Promise<CategorizationResult | null> {
    if (!openai) return null;

    try {
      // Get available categories
      const categories = await prisma.category.findMany({
        where: {
          OR: [{ isSystem: true }, { userId }],
        },
        select: { id: true, name: true },
      });

      const categoryList = categories.map((c) => c.name).join(', ');
      const merchantInfo = transaction.merchantName || transaction.description;

      const prompt = `Categorize this transaction into one of these categories: ${categoryList}

Transaction: ${merchantInfo}

Respond with ONLY the category name, nothing else.`;

      const response = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        max_tokens: 20,
      });

      const suggestedCategory = response.choices[0]?.message?.content?.trim();
      
      if (suggestedCategory) {
        // Find the category by name
        const category = categories.find(
          (c) => c.name.toLowerCase() === suggestedCategory.toLowerCase()
        );

        if (category) {
          return {
            categoryId: category.id,
            confidence: 80, // Good confidence for AI categorization
          };
        }
      }
    } catch (error: any) {
      console.error('OpenAI categorization error:', error.message);
    }

    return null;
  }

  /**
   * Get default "Uncategorized" category
   */
  private async getDefaultCategory(_userId: string): Promise<CategoryResponse> {
    let category = await prisma.category.findFirst({
      where: {
        name: 'Uncategorized',
        isSystem: true,
      },
    });

    // If Uncategorized doesn't exist, create it
    if (!category) {
      category = await prisma.category.create({
        data: {
          name: 'Uncategorized',
          icon: '❓',
          color: '#999999',
          isSystem: true,
        },
      });
    }

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

  /**
   * Get all categories available to a user (system + user-created)
   */
  async getCategories(userId: string): Promise<CategoryResponse[]> {
    const categories = await prisma.category.findMany({
      where: {
        OR: [
          { isSystem: true },
          { userId },
        ],
      },
      orderBy: { name: 'asc' },
    });

    return categories.map(cat => ({
      id: cat.id,
      userId: cat.userId || undefined,
      name: cat.name,
      icon: cat.icon,
      color: cat.color,
      parentCategoryId: cat.parentCategoryId || undefined,
      isSystem: cat.isSystem,
      createdAt: cat.createdAt,
    }));
  }

  /**
   * Learn from user correction and create categorization rule
   * Requirements: 3.5
   */
  async learnFromCorrection(
    userId: string,
    transactionId: string,
    newCategoryId: string
  ): Promise<void> {
    // Get the transaction to extract merchant information
    const transaction = await prisma.transaction.findFirst({
      where: {
        id: transactionId,
        userId,
      },
    });

    if (!transaction) {
      throw new Error('Transaction not found');
    }

    // Verify the category exists and is accessible to the user
    const category = await prisma.category.findFirst({
      where: {
        id: newCategoryId,
        OR: [
          { userId },
          { isSystem: true },
        ],
      },
    });

    if (!category) {
      throw new Error('Category not found');
    }

    // Extract merchant name for pattern creation
    const merchantName = transaction.merchantName || transaction.description;
    
    // Create a pattern from the merchant name
    // Escape special regex characters and make it case-insensitive
    const merchantPattern = this.createMerchantPattern(merchantName);

    // Check if a similar rule already exists
    const existingRule = await prisma.categorizationRule.findFirst({
      where: {
        userId,
        merchantPattern,
      },
    });

    if (existingRule) {
      // Update existing rule with new category and increase priority
      await prisma.categorizationRule.update({
        where: { id: existingRule.id },
        data: {
          categoryId: newCategoryId,
          priority: existingRule.priority + 1,
          learnedFromUser: true,
        },
      });
    } else {
      // Get the highest priority for user's rules
      const highestPriorityRule = await prisma.categorizationRule.findFirst({
        where: { userId },
        orderBy: { priority: 'desc' },
      });

      const newPriority = highestPriorityRule ? highestPriorityRule.priority + 1 : 100;

      // Create new categorization rule
      await prisma.categorizationRule.create({
        data: {
          userId,
          merchantPattern,
          categoryId: newCategoryId,
          priority: newPriority,
          learnedFromUser: true,
        },
      });
    }
  }

  /**
   * Create a regex pattern from merchant name
   * Escapes special characters and creates a flexible pattern
   */
  private createMerchantPattern(merchantName: string): string {
    // Remove common suffixes and clean the name
    let cleanName = merchantName
      .replace(/\s+(inc|llc|ltd|corp|co|store|#\d+)\.?$/i, '')
      .trim();

    // Escape special regex characters
    cleanName = cleanName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    // Create a pattern that matches the core merchant name
    // Allow for optional characters at the end (like store numbers)
    return `^${cleanName}`;
  }

  /**
   * Get all categorization rules for a user
   */
  async getCategorizationRules(userId: string) {
    const rules = await prisma.categorizationRule.findMany({
      where: { userId },
      include: {
        category: true,
      },
      orderBy: { priority: 'desc' },
    });

    return rules.map(rule => ({
      id: rule.id,
      userId: rule.userId,
      merchantPattern: rule.merchantPattern,
      categoryId: rule.categoryId,
      categoryName: rule.category.name,
      priority: rule.priority,
      learnedFromUser: rule.learnedFromUser,
      createdAt: rule.createdAt,
    }));
  }
}

export default new CategorizationService();
