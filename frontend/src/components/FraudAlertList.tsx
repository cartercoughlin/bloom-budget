import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

interface FraudAlert {
  id: string;
  transactionId: string;
  alertType: 'unusual_amount' | 'unusual_location' | 'rapid_transactions';
  severity: 'low' | 'medium' | 'high';
  reason: string;
  isReviewed: boolean;
  isFalsePositive: boolean;
  createdAt: string;
  transaction?: {
    amount: number;
    merchantName: string;
    date: string;
  };
}

export function FraudAlertList() {
  const queryClient = useQueryClient();

  const { data: alerts, isLoading } = useQuery<FraudAlert[]>({
    queryKey: ['fraud-alerts'],
    queryFn: async () => {
      const response = await fetch('/api/fraud/alerts?includeReviewed=true', {
        credentials: 'include',
      });
      if (!response.ok) {
        throw new Error('Failed to fetch fraud alerts');
      }
      const data = await response.json();
      return data.alerts || [];
    },
  });

  const reviewMutation = useMutation({
    mutationFn: async ({ alertId, isFalsePositive }: { alertId: string; isFalsePositive: boolean }) => {
      const response = await fetch(`/api/fraud/alerts/${alertId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ isReviewed: true, isFalsePositive }),
      });
      if (!response.ok) {
        throw new Error('Failed to update alert');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fraud-alerts'] });
    },
  });

  const formatCurrency = (amount: number) => {
    // In Plaid: positive = debit (money out), negative = credit (money in)
    // Display as: negative for money out, positive for money in
    const displayAmount = -amount;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      signDisplay: 'always',
    }).format(displayAmount);
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

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high':
        return 'bg-red-100 text-red-800';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800';
      case 'low':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getAlertTypeLabel = (type: string) => {
    switch (type) {
      case 'unusual_amount':
        return 'Unusual Amount';
      case 'unusual_location':
        return 'Unusual Location';
      case 'rapid_transactions':
        return 'Rapid Transactions';
      default:
        return type;
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="text-gray-500">Loading fraud alerts...</div>
      </div>
    );
  }

  const unreviewed = alerts?.filter((a) => !a.isReviewed) || [];
  const reviewed = alerts?.filter((a) => a.isReviewed) || [];

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">Fraud Alerts</h2>

      {unreviewed.length === 0 && reviewed.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <p className="text-gray-500">No fraud alerts</p>
        </div>
      ) : (
        <>
          {unreviewed.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900">Unreviewed Alerts</h3>
              {unreviewed.map((alert) => (
                <div key={alert.id} className="bg-white rounded-lg shadow p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`px-2 py-1 text-xs rounded-full ${getSeverityColor(alert.severity)}`}>
                          {alert.severity.toUpperCase()}
                        </span>
                        <span className="text-sm font-medium text-gray-900">
                          {getAlertTypeLabel(alert.alertType)}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 mb-2">{alert.reason}</p>
                      {alert.transaction && (
                        <div className="text-sm text-gray-500">
                          <span className="font-medium">{formatCurrency(alert.transaction.amount)}</span>
                          {' at '}
                          <span>{alert.transaction.merchantName || 'Unknown'}</span>
                          {' on '}
                          <span>{formatDate(alert.transaction.date)}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => reviewMutation.mutate({ alertId: alert.id, isFalsePositive: false })}
                      disabled={reviewMutation.isPending}
                      className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 disabled:opacity-50"
                    >
                      Confirm Fraud
                    </button>
                    <button
                      onClick={() => reviewMutation.mutate({ alertId: alert.id, isFalsePositive: true })}
                      disabled={reviewMutation.isPending}
                      className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
                    >
                      Mark as Safe
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {reviewed.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900">Reviewed Alerts</h3>
              {reviewed.map((alert) => (
                <div key={alert.id} className="bg-gray-50 rounded-lg p-6 opacity-75">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`px-2 py-1 text-xs rounded-full ${getSeverityColor(alert.severity)}`}>
                          {alert.severity.toUpperCase()}
                        </span>
                        <span className="text-sm font-medium text-gray-900">
                          {getAlertTypeLabel(alert.alertType)}
                        </span>
                        {alert.isFalsePositive && (
                          <span className="px-2 py-1 text-xs rounded-full bg-green-100 text-green-800">
                            False Positive
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-600">{alert.reason}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
