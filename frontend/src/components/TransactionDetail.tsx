import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

interface Transaction {
  id: string;
  amount: number;
  date: string;
  merchantName: string;
  description: string;
  categoryId: string;
  categoryConfidence: number;
  isPending: boolean;
  isFraudulent: boolean;
  location?: {
    city?: string;
    region?: string;
    country?: string;
  };
}

interface TransactionDetailProps {
  transaction: Transaction;
  onClose: () => void;
}

export function TransactionDetail({ transaction, onClose }: TransactionDetailProps) {
  const [selectedCategoryId, setSelectedCategoryId] = useState(transaction.categoryId);
  const queryClient = useQueryClient();

  const { data: categoriesData } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const response = await fetch('/api/categories', {
        credentials: 'include',
      });
      if (!response.ok) return { categories: [] };
      return response.json();
    },
  });

  const updateCategoryMutation = useMutation({
    mutationFn: async (categoryId: string) => {
      const response = await fetch(`/api/transactions/${transaction.id}/category`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ categoryId }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to update category');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      onClose();
    },
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    }).format(date);
  };

  const handleSave = () => {
    if (selectedCategoryId !== transaction.categoryId) {
      updateCategoryMutation.mutate(selectedCategoryId);
    } else {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-2xl w-full p-6">
        <div className="flex justify-between items-start mb-6">
          <h2 className="text-2xl font-bold text-gray-900">Transaction Details</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-500">Date</label>
              <p className="mt-1 text-lg text-gray-900">{formatDate(transaction.date)}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-500">Amount</label>
              <p className="mt-1 text-lg font-semibold text-gray-900">
                {formatCurrency(transaction.amount)}
              </p>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-500">Merchant</label>
            <p className="mt-1 text-lg text-gray-900">{transaction.merchantName || 'N/A'}</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-500">Description</label>
            <p className="mt-1 text-lg text-gray-900">{transaction.description}</p>
          </div>

          {transaction.location && (transaction.location.city || transaction.location.region) && (
            <div>
              <label className="block text-sm font-medium text-gray-500">Location</label>
              <p className="mt-1 text-lg text-gray-900">
                {[transaction.location.city, transaction.location.region, transaction.location.country]
                  .filter(Boolean)
                  .join(', ')}
              </p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-500 mb-2">
              Category
              {transaction.categoryConfidence < 70 && (
                <span className="ml-2 text-xs text-yellow-600">
                  (Low confidence: {transaction.categoryConfidence}%)
                </span>
              )}
            </label>
            <select
              value={selectedCategoryId}
              onChange={(e) => setSelectedCategoryId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            >
              {categoriesData?.categories.map((category: any) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex gap-2">
            {transaction.isPending && (
              <span className="px-3 py-1 text-sm rounded-full bg-yellow-100 text-yellow-800">
                Pending
              </span>
            )}
            {transaction.isFraudulent && (
              <span className="px-3 py-1 text-sm rounded-full bg-red-100 text-red-800">
                Flagged as Fraudulent
              </span>
            )}
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={updateCategoryMutation.isPending}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {updateCategoryMutation.isPending ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
