import React, { useState } from 'react';

interface GanttChartProps {
  results: Array<{
    algo: string;
    algo_name: string;
    metrics?: {
      p95_latency: number;
    };
    gantt_data: {
      slots: number;
      simulation_duration: number;
      jobs: Array<{
        id: string;
        owner: string;
        priority: number;
        arrival_time: number;
        deadline: number | null;
        segments: Array<{ start: number; end: number; slot: number }>;
        completed_at: number;
        missed_deadline: boolean;
        was_starving: boolean;
      }>;
    };
  }>;
}

const SLOT_COLORS = [
  '#3B82F6', // Blue
  '#22C55E', // Green
  '#F59E0B', // Amber
  '#8B5CF6', // Purple
  '#EC4899', // Pink
  '#06B6D4', // Cyan
  '#F97316', // Orange
  '#14B8A6', // Teal
];

const getColorByOwner = (owner: string, index: number): string => {
  if (owner && owner !== 'default') {
    let hash = 0;
    for (let i = 0; i < owner.length; i++) {
      hash = owner.charCodeAt(i) + ((hash << 5) - hash);
    }
    return SLOT_COLORS[Math.abs(hash) % SLOT_COLORS.length];
  }
  return SLOT_COLORS[index % SLOT_COLORS.length];
};

export const GanttChart: React.FC<GanttChartProps> = ({ results }) => {
  const [hoveredJob, setHoveredJob] = useState<{ job: any; x: number; y: number } | null>(null);
  const [collapsedAlgorithms, setCollapsedAlgorithms] = useState<Set<string>>(new Set());

  const toggleCollapse = (algo: string) => {
    setCollapsedAlgorithms(prev => {
      const newSet = new Set(prev);
      if (newSet.has(algo)) {
        newSet.delete(algo);
      } else {
        newSet.add(algo);
      }
      return newSet;
    });
  };

  if (!results || results.length === 0) return null;

  const firstResult = results[0];
  const maxDuration = firstResult.gantt_data.simulation_duration;
  const numSlots = firstResult.gantt_data.slots;

  return (
    <div className="bg-white border rounded-lg p-4 shadow-sm mb-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Gantt Chart</h3>
      
      {results.map((result) => {
        const isCollapsed = collapsedAlgorithms.has(result.algo);
        
        return (
          <div key={result.algo} className="mb-4 last:mb-0">
            {/* Algorithm Header */}
            <div 
              className="flex items-center justify-between bg-gray-50 px-3 py-2 rounded cursor-pointer"
              onClick={() => toggleCollapse(result.algo)}
            >
              <div className="flex items-center gap-2">
                <span className="text-lg">{isCollapsed ? '▶' : '▼'}</span>
                <span className="font-medium">{result.algo_name}</span>
              </div>
              <span className="text-sm text-gray-500">
                p95: {result.metrics?.p95_latency?.toFixed(1) || 'N/A'} ms
              </span>
            </div>

            {!isCollapsed && (
              <div className="mt-2 border rounded overflow-hidden">
                {/* Time Axis */}
                <div className="flex border-b bg-gray-50">
                  <div className="w-16 flex-shrink-0 px-2 py-1 text-xs text-gray-500 border-r">Slot</div>
                  <div className="flex-1 relative h-6">
                    {[0, 0.25, 0.5, 0.75, 1].map((pos, i) => (
                      <div 
                        key={i}
                        className="absolute text-xs text-gray-400"
                        style={{ left: `${pos * 100}%`, transform: 'translateX(-50%)' }}
                      >
                        {Math.round(maxDuration * pos)}ms
                      </div>
                    ))}
                  </div>
                </div>

                {/* Slots */}
                {Array.from({ length: numSlots }).map((_, slotIdx) => (
                  <div key={slotIdx} className="flex border-b last:border-b-0">
                    <div className="w-16 flex-shrink-0 px-2 py-2 text-xs text-gray-500 border-r bg-gray-50">
                      Slot {slotIdx}
                    </div>
                    <div className="flex-1 relative h-10">
                      {/* Grid lines */}
                      {[0, 0.25, 0.5, 0.75, 1].map((pos, i) => (
                        <div 
                          key={i}
                          className="absolute top-0 bottom-0 border-l border-gray-100"
                          style={{ left: `${pos * 100}%` }}
                        />
                      ))}
                      
                      {/* Job bars */}
                      {result.gantt_data.jobs
                        .filter(job => job.segments.some(seg => seg.slot === slotIdx))
                        .map((job, jobIndex) => {
                          const segment = job.segments.find(seg => seg.slot === slotIdx);
                          if (!segment) return null;
                          
                          const left = (segment.start / maxDuration) * 100;
                          const width = Math.max(((segment.end - segment.start) / maxDuration) * 100, 1);
                          const color = getColorByOwner(job.owner, jobIndex);
                          
                          return (
                            <div
                              key={job.id}
                              className={`absolute h-8 top-1 rounded cursor-pointer transition-transform hover:scale-105 ${
                                job.was_starving ? 'ring-2 ring-orange-500' : ''
                              } ${
                                job.missed_deadline ? 'ring-2 ring-red-500' : ''
                              }`}
                              style={{
                                left: `${left}%`,
                                width: `${width}%`,
                                backgroundColor: color,
                                opacity: 0.8,
                              }}
                              onMouseEnter={(e) => {
                                const rect = e.currentTarget.getBoundingClientRect();
                                setHoveredJob({ job, x: rect.left, y: rect.top });
                              }}
                              onMouseLeave={() => setHoveredJob(null)}
                            >
                              <span className="text-xs text-white px-1 truncate block">
                                {job.id}
                              </span>
                            </div>
                          );
                        })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}

      {/* Tooltip */}
      {hoveredJob && (
        <div 
          className="fixed z-50 bg-gray-900 text-white text-xs rounded px-3 py-2 pointer-events-none"
          style={{ 
            left: `${hoveredJob.x + 10}px`, 
            top: `${hoveredJob.y - 60}px`,
          }}
        >
          <div className="font-medium">Job: {hoveredJob.job.id}</div>
          <div>Owner: {hoveredJob.job.owner}</div>
          <div>Arrived: {hoveredJob.job.arrival_time}ms</div>
          <div>Priority: {hoveredJob.job.priority.toFixed(2)}</div>
          {hoveredJob.job.deadline && (
            <div>Deadline: {hoveredJob.job.deadline}ms [{hoveredJob.job.missed_deadline ? 'MISSED' : 'Met'}]</div>
          )}
          {hoveredJob.job.was_starving && (
            <div className="text-orange-400">⚠ Starving</div>
          )}
        </div>
      )}
    </div>
  );
};

export default GanttChart;
