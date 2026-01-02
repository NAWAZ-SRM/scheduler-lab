import React from 'react';

interface MetricsCardsProps {
  results: Array<{
    algo: string;
    algo_name: string;
    metrics: {
      p50_latency: number;
      p95_latency: number;
      p99_latency: number;
      throughput: number;
      fairness_index: number;
      deadline_miss_rate: number | null;
      total_jobs: number;
      completed_jobs: number;
      starved_jobs: number;
      total_preemptions: number;
      avg_queue_depth: number;
    };
  }>;
}

const getLatencyColor = (ms: number) => {
  if (ms < 500) return 'text-green-600 bg-green-50 border-green-200';
  if (ms < 2000) return 'text-yellow-600 bg-yellow-50 border-yellow-200';
  return 'text-red-600 bg-red-50 border-red-200';
};

const getFairnessColor = (value: number) => {
  if (value > 0.8) return 'text-green-600 bg-green-50 border-green-200';
  if (value >= 0.5) return 'text-yellow-600 bg-yellow-50 border-yellow-200';
  return 'text-red-600 bg-red-50 border-red-200';
};

const getDeadlineColor = (rate: number | null) => {
  if (rate === null || rate === 0) return 'text-green-600 bg-green-50 border-green-200';
  if (rate <= 0.2) return 'text-yellow-600 bg-yellow-50 border-yellow-200';
  return 'text-red-600 bg-red-50 border-red-200';
};

export const MetricsCards: React.FC<MetricsCardsProps> = ({ results }) => {
  if (!results || results.length === 0) return null;

  return (
    <div className="grid grid-cols-4 gap-4 mb-6">
      {/* p95 Latency Card */}
      <div className="bg-white border rounded-lg p-4 shadow-sm">
        <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">p95 Latency</div>
        <div className="text-2xl font-bold">
          {results[0].metrics.p95_latency.toFixed(1)} ms
        </div>
        <div className="text-xs text-gray-400 mt-1">95% of jobs within this time</div>
        {results.length > 1 && (
          <div className="mt-2 space-y-1">
            {results.map((r, i) => (
              <div key={i} className="flex justify-between text-xs">
                <span className="text-gray-500">{r.algo_name}:</span>
                <span className={getLatencyColor(r.metrics.p95_latency).split(' ')[0]}>
                  {r.metrics.p95_latency.toFixed(1)} ms
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Throughput Card */}
      <div className="bg-white border rounded-lg p-4 shadow-sm">
        <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Throughput</div>
        <div className="text-2xl font-bold">
          {results[0].metrics.throughput.toFixed(1)} <span className="text-sm font-normal">jobs/s</span>
        </div>
        <div className="text-xs text-gray-400 mt-1">Jobs completed per second</div>
        {results.length > 1 && (
          <div className="mt-2 space-y-1">
            {results.map((r, i) => (
              <div key={i} className="flex justify-between text-xs">
                <span className="text-gray-500">{r.algo_name}:</span>
                <span className="text-gray-700">{r.metrics.throughput.toFixed(1)} jobs/s</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Fairness Card */}
      <div className="bg-white border rounded-lg p-4 shadow-sm">
        <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Fairness</div>
        <div className="text-2xl font-bold">
          {(results[0].metrics.fairness_index * 100).toFixed(0)}%
        </div>
        <div className="text-xs text-gray-400 mt-1">Jain's Fairness Index</div>
        {results.length > 1 && (
          <div className="mt-2 space-y-1">
            {results.map((r, i) => (
              <div key={i} className="flex justify-between text-xs">
                <span className="text-gray-500">{r.algo_name}:</span>
                <span className={getFairnessColor(r.metrics.fairness_index).split(' ')[0]}>
                  {(r.metrics.fairness_index * 100).toFixed(0)}%
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Deadline Miss Rate Card */}
      <div className="bg-white border rounded-lg p-4 shadow-sm">
        <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Deadline Miss</div>
        <div className="text-2xl font-bold">
          {results[0].metrics.deadline_miss_rate !== null 
            ? `${(results[0].metrics.deadline_miss_rate * 100).toFixed(1)}%`
            : 'N/A'}
        </div>
        <div className="text-xs text-gray-400 mt-1">
          {results[0].metrics.deadline_miss_rate !== null 
            ? `${results[0].metrics.deadline_miss_rate === 0 ? 'All met' : 'Missed deadlines'}`
            : 'No deadlines in workload'}
        </div>
        {results.length > 1 && (
          <div className="mt-2 space-y-1">
            {results.map((r, i) => (
              <div key={i} className="flex justify-between text-xs">
                <span className="text-gray-500">{r.algo_name}:</span>
                <span className={getDeadlineColor(r.metrics.deadline_miss_rate).split(' ')[0]}>
                  {r.metrics.deadline_miss_rate !== null 
                    ? `${(r.metrics.deadline_miss_rate * 100).toFixed(1)}%`
                    : 'N/A'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default MetricsCards;
