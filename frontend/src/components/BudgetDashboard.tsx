import { useQuery } from '@tanstack/react-query';

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
  spent?: number;
  percentageUsed?: number;
}

interface BudgetDashboardProps {
  onCreateBudget: () => void;
  onEditBudget: (budget: Budget) => void;
}

export function BudgetDashboard({ onCreateBudget, onEditBudget }: BudgetDashboardProps) {
  const { data: budgets, isLoading } = useQuery<Budget[]>({
    queryKey: ['budgets'],
    queryFn: async () => {
      const response = await fetch('/api/budgets', {
        credentials: 'include',
      });
      if (!response.ok) {
        throw new Error('Failed to fetch budgets');
      }
      const data = await response.json();
      const budgetsList = Array.isArray(data) ? data : (data.budgets || []);
      
      // Fetch progress for each budget
      const budgetsWithProgress = await Promise.all(
        budgetsList.map(async (budget: Budget) => {
          try {
            const progressResponse = await fetch(`/api/budgets/${budget.id}/progress`, {
              credentials: 'include',
            });
            if (progressResponse.ok) {
              const progress = await progressResponse.json();
              return {
                ...budget,
                spent: progress.spent,
                percentageUsed: progress.percentageUsed,
              };
            }
          } catch (error) {
            console.error('Failed to fetch progress for budget', budget.id);
          }
          return budget;
        })
      );
      
      return budgetsWithProgress;
    },
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const getProgressColor = (percentage: number, threshold: number) => {
    if (percentage >= 100) return 'bg-red-500';
    if (percentage >= threshold) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  const getStatusBadge = (percentage: number, threshold: number) => {
    if (percentage >= 100) {
      return (
        <span className="px-2 py-1 text-xs rounded-full bg-red-100 text-red-800">
          Over Budget
        </span>
      );
    }
    if (percentage >= threshold) {
      return (
        <span className="px-2 py-1 text-xs rounded-full bg-yellow-100 text-yellow-800">
          Near Limit
        </span>
      );
    }
    return (
      <span className="px-2 py-1 text-xs rounded-full bg-green-100 text-green-800">
        On Track
      </span>
    );
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="text-gray-500">Loading budgets...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">Budget Dashboard</h2>
        <button
          onClick={onCreateBudget}
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
        >
          + Create Budget
        </button>
      </div>

      {budgets && budgets.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <p className="text-gray-500 mb-4">No budgets created yet</p>
          <p className="text-sm text-gray-400">
            Click "Create Budget" to set spending limits for your categories
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {budgets?.map((budget) => (
            <div
              key={budget.id}
              className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow cursor-pointer"
              onClick={() => onEditBudget(budget)}
            >
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    {budget.categoryName || 'Unknown Category'}
                  </h3>
                  <p className="text-sm text-gray-500 capitalize">{budget.period}</p>
                </div>
                {budget.percentageUsed !== undefined && (
                  <div>{getStatusBadge(budget.percentageUsed, budget.alertThreshold)}</div>
                )}
              </div>

              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Spent:</span>
                  <span className="font-medium text-gray-900">
                    {formatCurrency(budget.spent || 0)}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Budget:</span>
                  <span className="font-medium text-gray-900">
                    {formatCurrency(budget.amount)}
                  </span>
                </div>

                {budget.percentageUsed !== undefined && (
                  <>
                    <div className="w-full bg-gray-200 rounded-full h-2.5">
                      <div
                        className={`h-2.5 rounded-full ${getProgressColor(
                          budget.percentageUsed,
                          budget.alertThreshold
                        )}`}
                        style={{ width: `${Math.min(budget.percentageUsed, 100)}%` }}
                      ></div>
                    </div>
                    <div className="flex justify-between text-xs text-gray-500">
                      <span>{budget.percentageUsed.toFixed(1)}% used</span>
                      <span>
                        {formatCurrency(budget.amount - (budget.spent || 0))} remaining
                      </span>
                    </div>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
