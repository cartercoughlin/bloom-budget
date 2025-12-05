import { useState } from 'react';
import { BudgetDashboard } from '../components/BudgetDashboard';
import { BudgetForm } from '../components/BudgetForm';

interface Budget {
  id: string;
  categoryId: string;
  categoryName?: string;
  amount: number;
  period: 'monthly' | 'quarterly' | 'annual';
  startDate: string;
  endDate: string;
  alertThreshold: number;
  isActive: boolean;
}

export function BudgetsPage() {
  const [showForm, setShowForm] = useState(false);
  const [editingBudget, setEditingBudget] = useState<Budget | undefined>();

  const handleCreateBudget = () => {
    setEditingBudget(undefined);
    setShowForm(true);
  };

  const handleEditBudget = (budget: Budget) => {
    setEditingBudget(budget);
    setShowForm(true);
  };

  const handleCloseForm = () => {
    setShowForm(false);
    setEditingBudget(undefined);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <BudgetDashboard onCreateBudget={handleCreateBudget} onEditBudget={handleEditBudget} />
      {showForm && <BudgetForm budget={editingBudget} onClose={handleCloseForm} />}
    </div>
  );
}
