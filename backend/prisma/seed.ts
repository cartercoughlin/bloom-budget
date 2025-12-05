import { PrismaClient } from '../src/generated/prisma';

const prisma = new PrismaClient();

const defaultCategories = [
  { name: 'Groceries', icon: '🛒', color: '#4CAF50' },
  { name: 'Dining & Restaurants', icon: '🍽️', color: '#FF9800' },
  { name: 'Transportation', icon: '🚗', color: '#2196F3' },
  { name: 'Utilities', icon: '💡', color: '#9C27B0' },
  { name: 'Entertainment', icon: '🎬', color: '#E91E63' },
  { name: 'Shopping', icon: '🛍️', color: '#F44336' },
  { name: 'Healthcare', icon: '🏥', color: '#00BCD4' },
  { name: 'Insurance', icon: '🛡️', color: '#607D8B' },
  { name: 'Housing', icon: '🏠', color: '#795548' },
  { name: 'Travel', icon: '✈️', color: '#3F51B5' },
  { name: 'Education', icon: '📚', color: '#009688' },
  { name: 'Personal Care', icon: '💆', color: '#FF5722' },
  { name: 'Subscriptions', icon: '📱', color: '#673AB7' },
  { name: 'Gifts & Donations', icon: '🎁', color: '#CDDC39' },
  { name: 'Income', icon: '💰', color: '#8BC34A' },
  { name: 'Other', icon: '📦', color: '#9E9E9E' },
];

async function main() {
  console.log('Seeding default categories...');

  for (const category of defaultCategories) {
    await prisma.category.upsert({
      where: { 
        // Use a composite unique constraint or find another way
        // For now, we'll check by name for system categories
        id: category.name.toLowerCase().replace(/\s+/g, '-'),
      },
      update: {},
      create: {
        id: category.name.toLowerCase().replace(/\s+/g, '-'),
        name: category.name,
        icon: category.icon,
        color: category.color,
        isSystem: true,
        userId: null,
      },
    });
  }

  console.log(`Seeded ${defaultCategories.length} default categories`);
}

main()
  .catch((e) => {
    console.error('Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
