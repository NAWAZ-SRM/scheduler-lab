import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { useSimulationStore } from '../stores/simulationStore';

export const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const { pastRuns } = useSimulationStore();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const handleNewSimulation = () => {
    navigate('/workbench');
  };

  const handleOpenRun = (runId: string) => {
    navigate(`/workbench/${runId}`);
  };

  // Format date for display
  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <div className="flex items-center space-x-4">
            <div className="text-right">
              <p className="text-sm text-gray-700 font-medium">{user?.username}</p>
              <p className="text-xs text-gray-500">{user?.email}</p>
            </div>
            <button
              onClick={handleLogout}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Welcome Section */}
        <div className="mb-12">
          <div className="bg-gradient-to-r from-indigo-500 to-indigo-600 rounded-lg shadow-lg p-8 text-white">
            <h2 className="text-3xl font-bold mb-4">Welcome, {user?.username}!</h2>
            <p className="text-indigo-100 mb-6 max-w-2xl">
              Start exploring CPU scheduling algorithms by running new simulations or reviewing your past runs.
            </p>
            <button
              onClick={handleNewSimulation}
              className="inline-block px-6 py-3 bg-white text-indigo-600 font-semibold rounded-lg hover:bg-gray-100 transition"
            >
              + New Simulation
            </button>
          </div>
        </div>

        {/* Past Runs Section */}
        <div>
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-2xl font-bold text-gray-900">Past Simulations</h3>
            {pastRuns.length > 0 && (
              <span className="text-sm text-gray-500">{pastRuns.length} runs</span>
            )}
          </div>

          {pastRuns.length === 0 ? (
            <div className="bg-white rounded-lg shadow p-12 text-center">
              <div className="text-6xl mb-4">📊</div>
              <h4 className="text-xl font-semibold text-gray-900 mb-2">No simulations yet</h4>
              <p className="text-gray-600 mb-6">
                Create your first simulation to get started exploring CPU scheduling algorithms.
              </p>
              <button
                onClick={handleNewSimulation}
                className="inline-block px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium"
              >
                Start New Simulation
              </button>
            </div>
          ) : (
            <div className="grid gap-4">
              <div className="bg-white shadow overflow-hidden rounded-lg">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                        Name
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                        Algorithm
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                        Jobs
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                        Date
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {pastRuns.map(run => (
                      <tr key={run.id} className="hover:bg-gray-50 transition">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {run.name}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          {run.algorithms_config.map(a => a.id).join(', ')}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          {run.workload_config.total_jobs}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          {formatDate(run.created_at)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm space-x-2">
                          <button
                            onClick={() => handleOpenRun(run.id)}
                            className="text-indigo-600 hover:text-indigo-700 font-medium"
                          >
                            View
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};
