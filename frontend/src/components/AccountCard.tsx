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

interface AccountCardProps {
  account: Account;
  onDisconnect: (accountId: string) => void;
  onSync: (accountId: string) => void;
  isSyncing?: boolean;
}

export function AccountCard({ account, onDisconnect, onSync, isSyncing }: AccountCardProps) {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(date);
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">{account.accountName}</h3>
          <p className="text-sm text-gray-500 capitalize">
            {account.accountType} - {account.accountSubtype}
          </p>
        </div>
        <button
          onClick={() => onDisconnect(account.id)}
          className="text-sm text-red-600 hover:text-red-800"
        >
          Disconnect
        </button>
      </div>
      
      <div className="space-y-2">
        <div className="flex justify-between">
          <span className="text-sm text-gray-600">Current Balance:</span>
          <span className="text-sm font-medium text-gray-900">
            {formatCurrency(account.currentBalance)}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-sm text-gray-600">Available Balance:</span>
          <span className="text-sm font-medium text-gray-900">
            {formatCurrency(account.availableBalance)}
          </span>
        </div>
        <div className="flex justify-between pt-2 border-t">
          <span className="text-xs text-gray-500">Last synced:</span>
          <span className="text-xs text-gray-500">{formatDate(account.lastSyncedAt)}</span>
        </div>
      </div>

      <button
        onClick={() => onSync(account.id)}
        disabled={isSyncing}
        className="mt-4 w-full px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 rounded-md hover:bg-blue-100 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isSyncing ? 'Syncing...' : 'Sync Transactions'}
      </button>
    </div>
  );
}
