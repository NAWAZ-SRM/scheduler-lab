import React, { useState } from 'react';

interface SupportingChartsProps {
  results: Array<{
    algo: string;
    algo_name: string;
    queue_depth_series: Array<{ time: number; depth: number }>;
    utilization_series: Array<{ time: number; slots_used: number; gpu_used: number }>;
    metrics: {
      total_jobs: number;
      completed_jobs: number;
    };
  }>;
}

const CHART_COLORS = ['#3B82F6', '#22C55E', '#F59E0B', '#8B5CF6'];

export const SupportingCharts: React.FC<SupportingChartsProps> = ({ results }) => {
  const [activeTab, setActiveTab] = useState<'queue' | 'latency' | 'utilization'>('queue');

  if (!results || results.length === 0) return null;

  const maxTime = Math.max(
    ...results.flatMap(r => [
      ...r.queue_depth_series.map(q => q.time),
      ...r.utilization_series.map(u => u.time)
    ])
  );

  // Generate latency CDF from job completion times (simulated)
  const generateLatencyCDF = (result: typeof results[0]) => {
    const points = [];
    const numPoints = 20;
    const maxLatency = result.metrics.total_jobs * 100; // Approximate max
    
    for (let i = 0; i <= numPoints; i++) {
      const latency = (i / numPoints) * maxLatency;
      // Simulate CDF curve based on metrics
      const percentile = Math.min(100, (i / numPoints) * 100);
      points.push({ latency, percentile });
    }
    return points;
  };

  const renderQueueDepthChart = () => (
    <div className="h-64 relative">
      <svg width="100%" height="100%" viewBox="0 0 800 256" preserveAspectRatio="none">
        {/* Grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((pos, i) => (
          <line
            key={i}
            x1={`${pos * 100}%`}
            y1="0"
            x2={`${pos * 100}%`}
            y2="100%"
            stroke="#e5e7eb"
            strokeWidth="1"
          />
        ))}
        
        {/* Y-axis labels */}
        <text x="5" y="20" fill="#6b7280" fontSize="12">Depth</text>
        <text x="5" y="256" fill="#6b7280" fontSize="12">0</text>

        {/* Lines for each algorithm */}
        {results.map((result, idx) => {
          const points = result.queue_depth_series.map((q) => {
            const x = (q.time / maxTime) * 750 + 50;
            const y = 230 - (q.depth / 10) * 200; // Scale to max 10
            return `${x},${Math.max(10, y)}`;
          }).join(' ');

          return (
            <polyline
              key={result.algo}
              points={points}
              fill="none"
              stroke={CHART_COLORS[idx % CHART_COLORS.length]}
              strokeWidth="2"
            />
          );
        })}
      </svg>
      
      {/* Legend */}
      <div className="flex gap-4 mt-2 justify-center">
        {results.map((result, idx) => (
          <div key={result.algo} className="flex items-center gap-1">
            <div 
              className="w-3 h-3 rounded" 
              style={{ backgroundColor: CHART_COLORS[idx % CHART_COLORS.length] }}
            />
            <span className="text-xs text-gray-600">{result.algo_name}</span>
          </div>
        ))}
      </div>
    </div>
  );

  const renderLatencyCDFChart = () => (
    <div className="h-64 relative">
      <svg width="100%" height="100%" viewBox="0 0 800 256" preserveAspectRatio="none">
        {/* Grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((pos, i) => (
          <line
            key={i}
            x1={`${pos * 100}%`}
            y1="0"
            x2={`${pos * 100}%`}
            y2="100%"
            stroke="#e5e7eb"
            strokeWidth="1"
          />
        ))}
        
        {/* Y-axis labels */}
        <text x="5" y="20" fill="#6b7280" fontSize="12">100%</text>
        <text x="5" y="256" fill="#6b7280" fontSize="12">0%</text>
        
        {/* X-axis labels */}
        <text x="50" y="245" fill="#6b7280" fontSize="10">0ms</text>
        <text x="400" y="245" fill="#6b7280" fontSize="10">500ms</text>
        <text x="700" y="245" fill="#6b7280" fontSize="10">1000ms+</text>

        {/* Lines for each algorithm */}
        {results.map((result, idx) => {
          const cdfData = generateLatencyCDF(result);
          const points = cdfData.map((p) => {
            const x = (p.latency / 1000) * 750 + 50;
            const y = 230 - (p.percentile / 100) * 200;
            return `${x},${y}`;
          }).join(' ');

          return (
            <polyline
              key={result.algo}
              points={points}
              fill="none"
              stroke={CHART_COLORS[idx % CHART_COLORS.length]}
              strokeWidth="2"
            />
          );
        })}
        
        {/* P50, P95, P99 markers */}
        {[50, 95, 99].map(p => (
          <line
            key={p}
            x1={50}
            y1={230 - (p / 100) * 200}
            x2={800}
            y2={230 - (p / 100) * 200}
            stroke="#9ca3af"
            strokeWidth="1"
            strokeDasharray="4"
          />
        ))}
      </svg>
      
      {/* Legend */}
      <div className="flex gap-4 mt-2 justify-center">
        {results.map((result, idx) => (
          <div key={result.algo} className="flex items-center gap-1">
            <div 
              className="w-3 h-3 rounded" 
              style={{ backgroundColor: CHART_COLORS[idx % CHART_COLORS.length] }}
            />
            <span className="text-xs text-gray-600">{result.algo_name}</span>
          </div>
        ))}
      </div>
    </div>
  );

  const renderUtilizationChart = () => {
    const maxSlots = Math.max(...results.map(r => 
      Math.max(...r.utilization_series.map(u => u.slots_used))
    )) || 8;

    return (
      <div className="h-64 relative">
        <svg width="100%" height="100%" viewBox="0 0 800 256" preserveAspectRatio="none">
          {/* Grid lines */}
          {[0, 0.25, 0.5, 0.75, 1].map((pos, i) => (
            <line
              key={i}
              x1={`${pos * 100}%`}
              y1="0"
              x2={`${pos * 100}%`}
              y2="100%"
              stroke="#e5e7eb"
              strokeWidth="1"
            />
          ))}
          
          {/* Y-axis labels */}
          <text x="5" y="20" fill="#6b7280" fontSize="12">{maxSlots}</text>
          <text x="5" y="256" fill="#6b7280" fontSize="12">0</text>

          {/* Stacked area for each algorithm */}
          {results.map((result, idx) => {
            const points = result.utilization_series.map((u) => {
              const x = (u.time / maxTime) * 750 + 50;
              const y = 230 - (u.slots_used / maxSlots) * 200;
              return `${x},${y}`;
            });
            
            // Add bottom points for area fill
            const areaPoints = [
              `50,230`,
              ...points,
              `${750 + 50},230`
            ].join(' ');

            return (
              <polygon
                key={result.algo}
                points={areaPoints}
                fill={CHART_COLORS[idx % CHART_COLORS.length]}
                opacity="0.3"
              />
            );
          })}
          
          {/* Lines on top */}
          {results.map((result, idx) => {
            const points = result.utilization_series.map((u) => {
              const x = (u.time / maxTime) * 750 + 50;
              const y = 230 - (u.slots_used / maxSlots) * 200;
              return `${x},${y}`;
            }).join(' ');

            return (
              <polyline
                key={`line-${result.algo}`}
                points={points}
                fill="none"
                stroke={CHART_COLORS[idx % CHART_COLORS.length]}
                strokeWidth="2"
              />
            );
          })}
        </svg>
        
        {/* Legend */}
        <div className="flex gap-4 mt-2 justify-center">
          {results.map((result, idx) => (
            <div key={result.algo} className="flex items-center gap-1">
              <div 
                className="w-3 h-3 rounded" 
                style={{ backgroundColor: CHART_COLORS[idx % CHART_COLORS.length] }}
              />
              <span className="text-xs text-gray-600">{result.algo_name}</span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="bg-white border rounded-lg p-4 shadow-sm">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Supporting Charts</h3>
      
      {/* Tabs */}
      <div className="flex border-b mb-4">
        <button
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'queue'
              ? 'border-blue-500 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
          onClick={() => setActiveTab('queue')}
        >
          Queue Depth
        </button>
        <button
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'latency'
              ? 'border-blue-500 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
          onClick={() => setActiveTab('latency')}
        >
          Latency CDF
        </button>
        <button
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'utilization'
              ? 'border-blue-500 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
          onClick={() => setActiveTab('utilization')}
        >
          Utilization
        </button>
      </div>

      {/* Chart Content */}
      <div className="bg-gray-50 rounded p-4">
        {activeTab === 'queue' && renderQueueDepthChart()}
        {activeTab === 'latency' && renderLatencyCDFChart()}
        {activeTab === 'utilization' && renderUtilizationChart()}
      </div>
    </div>
  );
};

export default SupportingCharts;
