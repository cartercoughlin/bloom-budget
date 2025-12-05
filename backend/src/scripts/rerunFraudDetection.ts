import getPrismaClient from '../config/database';
import fraudDetectionService from '../services/fraudDetectionService';
import { TransactionModel } from '../models/Transaction';

const prisma = getPrismaClient();

async function rerunFraudDetection() {
  try {
    console.log('Starting fraud detection re-run...\n');

    // Step 1: Clear all existing fraud alerts
    console.log('Step 1: Clearing existing fraud alerts...');
    const deletedAlerts = await prisma.fraudAlert.deleteMany({});
    console.log(`✓ Deleted ${deletedAlerts.count} fraud alerts\n`);

    // Step 2: Reset isFraudulent flag on all transactions
    console.log('Step 2: Resetting fraud flags on transactions...');
    const resetTransactions = await prisma.transaction.updateMany({
      where: { isFraudulent: true },
      data: { isFraudulent: false },
    });
    console.log(`✓ Reset ${resetTransactions.count} transactions\n`);

    // Step 3: Get all transactions ordered by date
    console.log('Step 3: Fetching all transactions...');
    const transactions = await prisma.transaction.findMany({
      orderBy: { date: 'asc' }, // Process in chronological order
    });
    console.log(`✓ Found ${transactions.length} transactions\n`);

    // Step 4: Re-run fraud detection on each transaction
    console.log('Step 4: Running fraud detection...');
    let alertsCreated = 0;
    let transactionsFlagged = 0;

    for (let i = 0; i < transactions.length; i++) {
      const tx = transactions[i];
      const transactionResponse = TransactionModel.toResponse(tx);

      try {
        const alerts = await fraudDetectionService.analyzeTransaction(transactionResponse);
        
        if (alerts.length > 0) {
          alertsCreated += alerts.length;
          transactionsFlagged++;
          
          // Mark transaction as fraudulent
          await prisma.transaction.update({
            where: { id: tx.id },
            data: { isFraudulent: true },
          });

          console.log(`  ⚠️  Transaction ${i + 1}/${transactions.length}: ${alerts.length} alert(s) - ${tx.merchantName || 'Unknown'} $${tx.amount}`);
        } else {
          // Progress indicator every 10 transactions
          if ((i + 1) % 10 === 0) {
            console.log(`  ✓ Processed ${i + 1}/${transactions.length} transactions...`);
          }
        }
      } catch (error: any) {
        console.error(`  ✗ Error analyzing transaction ${tx.id}:`, error.message);
      }
    }

    console.log('\n=== Fraud Detection Complete ===');
    console.log(`Total transactions processed: ${transactions.length}`);
    console.log(`Transactions flagged: ${transactionsFlagged}`);
    console.log(`Fraud alerts created: ${alertsCreated}`);
    console.log('================================\n');

    process.exit(0);
  } catch (error: any) {
    console.error('Error re-running fraud detection:', error.message);
    process.exit(1);
  }
}

rerunFraudDetection();
