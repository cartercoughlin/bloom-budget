import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AccountCard } from './AccountCard';
import { AccountLinkButton } from './AccountLinkButton';
import { useState } from 'react';

interface Account {
  id: string;
  accountName: string;
  accountType: string;
  accountSubtype: string;
  currentBalance: number;
  availableBalance: number;
  lastSyncedAt: string;
  isActive: boolean;
}

export function AccountList() {
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [syncingAccountId, setSyncingAccountId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data: accounts, isLoading } = useQuery<Account[]>({
    queryKey: ['accounts'],
    queryFn: async () => {
      const response = await fetch('/api/plaid/accounts', {
        credentials: 'include',
      });
      if (!response.ok) {
        throw new Error('Failed to fetch accounts');
      }
      const data = await response.json();
      return data.accounts;
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: async (accountId: string) => {
      const response = await fetch(`/api/plaid/accounts/${accountId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to disconnect account');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      setSuccess('Account disconnected successfully');
      setTimeout(() => setSuccess(''), 3000);
    },
    onError: (err: any) => {
      setError(err.message);
      setTimeout(() => setError(''), 5000);
    },
  });

  const handleLinkSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ['accounts'] });
    setSuccess('Account linked successfully!');
    setTimeout(() => setSuccess(''), 3000);
  };

  const handleLinkError = (errorMessage: string) => {
    setError(errorMessage);
    setTimeout(() => setError(''), 5000);
  };

  const syncMutation = useMutation({
    mutationFn: async (accountId: string) => {
      setSyncingAccountId(accountId);
      const response = await fetch('/api/plaid/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ accountId }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to sync transactions');
      }
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      setSuccess(`Synced ${data.added || 0} new transactions`);
      setTimeout(() => setSuccess(''), 3000);
      setSyncingAccountId(null);
    },
    onError: (err: any) => {
      setError(err.message);
      setTimeout(() => setError(''), 5000);
      setSyncingAccountId(null);
    },
  });

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="text-gray-500">Loading accounts...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">Connected Accounts</h2>
        <AccountLinkButton onSuccess={handleLinkSuccess} onError={handleLinkError} />
      </div>

      {error && (
        <div className="rounded-md bg-red-50 p-4">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {success && (
        <div className="rounded-md bg-green-50 p-4">
          <p className="text-sm text-green-800">{success}</p>
        </div>
      )}

      {accounts && accounts.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <p className="text-gray-500 mb-4">No accounts connected yet</p>
          <p className="text-sm text-gray-400">
            Click "Link Account" to connect your bank or credit card
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {accounts?.map((account) => (
            <AccountCard
              key={account.id}
              account={account}
              onDisconnect={(id) => disconnectMutation.mutate(id)}
              onSync={(id) => syncMutation.mutate(id)}
              isSyncing={syncingAccountId === account.id}
            />
          ))}
        </div>
      )}
    </div>
  );
}
