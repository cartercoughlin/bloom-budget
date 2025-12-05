import { SpendingChart } from '../components/SpendingChart';
import { TrendAnalysis } from '../components/TrendAnalysis';
import { ReportExport } from '../components/ReportExport';

export function ReportsPage() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-3xl font-bold mb-8 text-gray-900">Reports & Analytics</h1>
      <div className="space-y-8">
        <SpendingChart />
        <TrendAnalysis />
        <ReportExport />
      </div>
    </div>
  );
}
