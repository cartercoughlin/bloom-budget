import { useQuery } from '@tanstack/react-query';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

export function TrendAnalysis() {
  const { data, isLoading } = useQuery({
    queryKey: ['trends'],
    queryFn: async () => {
      const response = await fetch('/api/reports/trends', {
        credentials: 'include',
      });
      if (!response.ok) {
        throw new Error('Failed to fetch trends');
      }
      return response.json();
    },
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
    }).format(value);
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="text-gray-500">Loading trend data...</div>
      </div>
    );
  }

  const trendData = data?.trends || [];

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-xl font-bold text-gray-900 mb-6">Spending Trends</h2>

      {trendData.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          No trend data available yet
        </div>
      ) : (
        <>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="period" />
                <YAxis tickFormatter={(value) => formatCurrency(value)} />
                <Tooltip formatter={(value: any) => formatCurrency(value)} />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="amount"
                  stroke="#3B82F6"
                  strokeWidth={2}
                  name="Total Spending"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {data?.comparison && (
            <div className="mt-6 pt-6 border-t grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center">
                <p className="text-sm text-gray-500">Current Period</p>
                <p className="text-2xl font-bold text-gray-900">
                  {formatCurrency(data.comparison.current)}
                </p>
              </div>
              <div className="text-center">
                <p className="text-sm text-gray-500">Previous Period</p>
                <p className="text-2xl font-bold text-gray-900">
                  {formatCurrency(data.comparison.previous)}
                </p>
              </div>
              <div className="text-center">
                <p className="text-sm text-gray-500">Change</p>
                <p
                  className={`text-2xl font-bold ${
                    data.comparison.percentageChange > 0 ? 'text-red-600' : 'text-green-600'
                  }`}
                >
                  {data.comparison.percentageChange > 0 ? '+' : ''}
                  {data.comparison.percentageChange.toFixed(1)}%
                </p>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
