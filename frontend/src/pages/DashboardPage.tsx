import { FraudAlertList } from '../components/FraudAlertList';
import { Link } from 'react-router-dom';

export function DashboardPage() {
  const quickLinks = [
    {
      title: 'Accounts',
      description: 'Link and manage your bank accounts',
      path: '/accounts',
      icon: '🏦',
      gradient: 'from-blue-500 to-cyan-500',
    },
    {
      title: 'Transactions',
      description: 'View and categorize your transactions',
      path: '/transactions',
      icon: '💳',
      gradient: 'from-green-500 to-emerald-500',
    },
    {
      title: 'Budgets',
      description: 'Create and track your budgets',
      path: '/budgets',
      icon: '📊',
      gradient: 'from-purple-500 to-pink-500',
    },
    {
      title: 'Reports',
      description: 'Analyze your spending patterns',
      path: '/reports',
      icon: '📈',
      gradient: 'from-orange-500 to-red-500',
    },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-4xl font-bold mb-8 bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
        Dashboard
      </h1>

      {/* Quick Navigation Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {quickLinks.map((link) => (
          <Link
            key={link.path}
            to={link.path}
            className="group relative bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-gray-700/50 hover:border-gray-600 transition-all duration-300 hover:scale-105 hover:shadow-2xl overflow-hidden"
          >
            <div className={`absolute inset-0 bg-gradient-to-br ${link.gradient} opacity-0 group-hover:opacity-10 transition-opacity duration-300`}></div>
            <div className="relative z-10">
              <div className="text-4xl mb-3">{link.icon}</div>
              <h3 className="text-lg font-semibold text-white mb-2">{link.title}</h3>
              <p className="text-sm text-gray-400">{link.description}</p>
            </div>
          </Link>
        ))}
      </div>

      {/* Fraud Alerts */}
      <FraudAlertList />
    </div>
  );
}
