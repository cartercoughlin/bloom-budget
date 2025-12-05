import getPrismaClient from '../config/database';
import categorizationService from '../services/categorizationService';

const prisma = getPrismaClient();

async function recategorizeTransactions() {
  console.log('Starting transaction recategorization...');

  try {
    // Get all transactions
    const transactions = await prisma.transaction.findMany({
      orderBy: { date: 'desc' },
    });

    console.log(`Found ${transactions.length} transactions to recategorize`);

    let processed = 0;
    let updated = 0;
    let errors = 0;

    for (const transaction of transactions) {
      try {
        // Skip if no merchant name or description
        if (!transaction.merchantName && !transaction.description) {
          console.log(`⊘ Skipping transaction ${transaction.id}: No merchant info`);
          processed++;
          continue;
        }

        // Categorize the transaction
        const result = await categorizationService.categorizeTransaction(
          transaction.userId,
          {
            merchantName: transaction.merchantName || undefined,
            description: transaction.description,
            plaidCategory: undefined, // We don't have this stored
          }
        );

        // Update if category changed
        if (result.categoryId !== transaction.categoryId) {
          await prisma.transaction.update({
            where: { id: transaction.id },
            data: {
              categoryId: result.categoryId,
              categoryConfidence: result.confidence,
            },
          });
          updated++;
          console.log(
            `✓ Updated: ${transaction.merchantName || transaction.description} -> ${result.categoryId} (${result.confidence}% confidence)`
          );
        }

        processed++;

        // Progress update every 10 transactions
        if (processed % 10 === 0) {
          console.log(`Progress: ${processed}/${transactions.length} processed, ${updated} updated`);
        }

        // Small delay to avoid rate limiting
        await new Promise((resolve) => setTimeout(resolve, 100));
      } catch (error: any) {
        errors++;
        console.error(`✗ Error processing transaction ${transaction.id}:`, error.message);
      }
    }

    console.log('\n=== Recategorization Complete ===');
    console.log(`Total processed: ${processed}`);
    console.log(`Updated: ${updated}`);
    console.log(`Errors: ${errors}`);
  } catch (error: any) {
    console.error('Fatal error:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
recategorizeTransactions();
