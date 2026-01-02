import { Link } from 'react-router-dom';

export const LandingPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Navigation */}
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <div className="text-2xl font-bold text-indigo-600">
            Scheduling Theory Workbench
          </div>
          <div className="space-x-4">
            <Link
              to="/login"
              className="px-4 py-2 text-indigo-600 hover:text-indigo-700 font-medium"
            >
              Login
            </Link>
            <Link
              to="/signup"
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium"
            >
              Sign Up
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center mb-16">
          <h1 className="text-5xl font-bold text-gray-900 mb-6">
            Explore CPU Scheduling Algorithms
          </h1>
          <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
            Interactively simulate and compare different scheduling algorithms. Understand how FCFS, SJF, SRPT, EDF, Round Robin, and CFS perform with real-world workloads.
          </p>
          <Link
            to="/signup"
            className="inline-block px-8 py-3 bg-indigo-600 text-white text-lg font-semibold rounded-lg hover:bg-indigo-700 transition"
          >
            Get Started Free
          </Link>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
          {/* Feature 1 */}
          <div className="bg-white rounded-lg shadow p-8">
            <div className="text-4xl mb-4">📊</div>
            <h3 className="text-xl font-semibold text-gray-900 mb-3">Compare Algorithms</h3>
            <p className="text-gray-600">
              Select up to 3 algorithms and run simulations side-by-side to see how they compare on the same workload.
            </p>
          </div>

          {/* Feature 2 */}
          <div className="bg-white rounded-lg shadow p-8">
            <div className="text-4xl mb-4">⚙️</div>
            <h3 className="text-xl font-semibold text-gray-900 mb-3">Customize Workloads</h3>
            <p className="text-gray-600">
              Generate realistic workloads with different arrival patterns, job durations, and mix in your own custom schedulers.
            </p>
          </div>

          {/* Feature 3 */}
          <div className="bg-white rounded-lg shadow p-8">
            <div className="text-4xl mb-4">📈</div>
            <h3 className="text-xl font-semibold text-gray-900 mb-3">Visualize Results</h3>
            <p className="text-gray-600">
              See Gantt charts, latency distributions, queue depth trends, and detailed metrics for each simulation run.
            </p>
          </div>
        </div>

        {/* Algorithm Cards */}
        <div className="mb-16">
          <h2 className="text-3xl font-bold text-gray-900 mb-8 text-center">
            Available Algorithms
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                name: 'FCFS',
                desc: 'First Come, First Served - The simplest scheduler.',
              },
              {
                name: 'SJF',
                desc: 'Shortest Job First - Minimizes average wait time.',
              },
              {
                name: 'SRPT',
                desc: 'Shortest Remaining Processing Time - Preemptive SJF.',
              },
              {
                name: 'EDF',
                desc: 'Earliest Deadline First - Deadline-aware scheduling.',
              },
              {
                name: 'Round Robin',
                desc: 'Fair time-slice based scheduling.',
              },
              {
                name: 'CFS',
                desc: 'Completely Fair Scheduler - Modern fairness approach.',
              },
            ].map(algo => (
              <div key={algo.name} className="bg-white rounded-lg shadow p-6">
                <h3 className="font-semibold text-lg text-gray-900 mb-2">
                  {algo.name}
                </h3>
                <p className="text-gray-600 text-sm">{algo.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* CTA Section */}
        <div className="bg-indigo-600 rounded-lg shadow-lg p-8 text-center text-white">
          <h2 className="text-3xl font-bold mb-4">
            Ready to Explore CPU Scheduling?
          </h2>
          <p className="text-lg mb-8 opacity-90">
            Start by creating an account to access the full simulation workbench.
          </p>
          <Link
            to="/signup"
            className="inline-block px-8 py-3 bg-white text-indigo-600 text-lg font-semibold rounded-lg hover:bg-gray-100 transition"
          >
            Create Free Account
          </Link>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-gray-800 text-gray-300 mt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 text-center">
          <p>&copy; 2024 Scheduling Theory Workbench. Educational tool for computer science.</p>
        </div>
      </footer>
    </div>
  );
};
