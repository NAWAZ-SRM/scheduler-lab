import React, { useState } from 'react';
import { useAlgorithmStore, FusionConfig } from '../stores/algorithmStore';

interface AlgorithmFusionProps {
  onClose: () => void;
}

const FUSION_RULES = [
  { 
    id: 'priority', 
    label: 'Priority-Based', 
    description: 'Use different algorithms based on job priority',
    example: 'High priority: EDF, Medium: SRPT, Low: FCFS'
  },
  { 
    id: 'duration', 
    label: 'Duration-Based', 
    description: 'Use different algorithms based on job duration',
    example: 'Short jobs: SJF, Long jobs: FCFS'
  },
  { 
    id: 'deadline', 
    label: 'Deadline-Aware', 
    description: 'Use EDF for jobs with deadlines, SRPT for others',
    example: 'Jobs with deadlines: EDF, Jobs without: SRPT'
  },
  { 
    id: 'gpu', 
    label: 'GPU-Aware', 
    description: 'Use different algorithms for GPU vs CPU jobs',
    example: 'GPU jobs: FCFS, CPU jobs: SRPT'
  },
];

export const AlgorithmFusion: React.FC<AlgorithmFusionProps> = ({ onClose }) => {
  const { 
    algorithms, 
    addAlgorithm,
    addFusion,
  } = useAlgorithmStore();

  const [fusionName, setFusionName] = useState('');
  const [selectedRule, setSelectedRule] = useState<string>('duration');
  const [threshold, setThreshold] = useState(500); // Duration threshold in ms
  const [selectedAlgos, setSelectedAlgos] = useState<string[]>([]);

  const availableAlgorithms = Object.values(algorithms);

  const handleAlgoToggle = (algoId: string) => {
    if (selectedAlgos.includes(algoId)) {
      setSelectedAlgos(selectedAlgos.filter(id => id !== algoId));
    } else if (selectedAlgos.length < 3) {
      setSelectedAlgos([...selectedAlgos, algoId]);
    }
  };

  const [showSuccess, setShowSuccess] = useState(false);

  const handleCreateFusion = () => {
    if (!fusionName.trim() || selectedAlgos.length < 2) {
      alert('Please enter a name and select at least 2 algorithms');
      return;
    }

    const newFusion: FusionConfig = {
      id: `fused_${Date.now()}`,
      name: fusionName,
      algorithms: selectedAlgos,
      rule: selectedRule as FusionConfig['rule'],
      threshold,
    };

    addFusion(newFusion);
    
    // Add the fused algorithms to selection (up to 3 max)
    selectedAlgos.forEach(algoId => {
      addAlgorithm(algoId);
    });

    // Show success message
    setShowSuccess(true);
    setTimeout(() => {
      setShowSuccess(false);
      onClose();
    }, 1500);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-card border border-border rounded-lg w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-border flex justify-between items-center">
          <h3 className="text-lg font-semibold text-card-foreground">Fuse Algorithms</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-4 space-y-6">
          {/* Name Input */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Fusion Name
            </label>
            <input
              type="text"
              value={fusionName}
              onChange={(e) => setFusionName(e.target.value)}
              className="w-full px-3 py-2 border border-input rounded-md bg-background text-foreground"
              placeholder="e.g., Hybrid Short-Long Scheduler"
            />
          </div>

          {/* Fusion Rules */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Fusion Rule
            </label>
            <div className="grid grid-cols-2 gap-2">
              {FUSION_RULES.map((rule) => (
                <button
                  key={rule.id}
                  onClick={() => setSelectedRule(rule.id)}
                  className={`p-3 border rounded-md text-left transition-colors ${
                    selectedRule === rule.id
                      ? 'bg-primary/10 border-primary'
                      : 'bg-background border-input hover:bg-muted'
                  }`}
                >
                  <p className="font-medium text-sm text-foreground">{rule.label}</p>
                  <p className="text-xs text-muted-foreground mt-1">{rule.description}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Threshold (for duration-based) */}
          {selectedRule === 'duration' && (
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Duration Threshold: {threshold}ms
              </label>
              <input
                type="range"
                min="100"
                max="5000"
                step="100"
                value={threshold}
                onChange={(e) => setThreshold(parseInt(e.target.value))}
                className="w-full"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Jobs shorter than {threshold}ms use Algorithm A, longer jobs use Algorithm B
              </p>
            </div>
          )}

          {/* Algorithm Selection */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Select Algorithms to Fuse (select 2-3)
            </label>
            <div className="grid grid-cols-2 gap-2">
              {availableAlgorithms.map((algo) => (
                <button
                  key={algo.id}
                  onClick={() => handleAlgoToggle(algo.id)}
                  className={`p-3 border rounded-md text-left transition-colors ${
                    selectedAlgos.includes(algo.id)
                      ? 'bg-primary/10 border-primary'
                      : 'bg-background border-input hover:bg-muted'
                  } ${selectedAlgos.length >= 3 && !selectedAlgos.includes(algo.id) ? 'opacity-50' : ''}`}
                  disabled={selectedAlgos.length >= 3 && !selectedAlgos.includes(algo.id)}
                >
                  <p className="font-medium text-sm text-foreground">{algo.name}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Preview */}
          {selectedAlgos.length >= 2 && (
            <div className="p-4 bg-muted rounded-md">
              <p className="text-sm font-medium text-foreground mb-2">Preview:</p>
              <div className="text-sm text-muted-foreground">
                {selectedRule === 'duration' && (
                  <p>
                    Jobs &lt; {threshold}ms: <strong>{algorithms[selectedAlgos[0]]?.name}</strong>
                    <br />
                    Jobs ≥ {threshold}ms: <strong>{algorithms[selectedAlgos[1]]?.name}</strong>
                    {selectedAlgos[2] && (
                      <>
                        <br />
                        Fallback: <strong>{algorithms[selectedAlgos[2]]?.name}</strong>
                      </>
                    )}
                  </p>
                )}
                {selectedRule === 'priority' && (
                  <p>
                    High priority (≥0.7): <strong>{algorithms[selectedAlgos[0]]?.name}</strong>
                    <br />
                    Medium priority (0.3-0.7): <strong>{algorithms[selectedAlgos[1]]?.name}</strong>
                    {selectedAlgos[2] && (
                      <>
                        <br />
                        Low priority (&lt;0.3): <strong>{algorithms[selectedAlgos[2]]?.name}</strong>
                      </>
                    )}
                  </p>
                )}
                {selectedRule === 'deadline' && (
                  <p>
                    Jobs with deadlines: <strong>{algorithms[selectedAlgos[0]]?.name}</strong>
                    <br />
                    Jobs without deadlines: <strong>{algorithms[selectedAlgos[1]]?.name}</strong>
                    {selectedAlgos[2] && (
                      <>
                        <br />
                        Fallback: <strong>{algorithms[selectedAlgos[2]]?.name}</strong>
                      </>
                    )}
                  </p>
                )}
                {selectedRule === 'gpu' && (
                  <p>
                    GPU jobs: <strong>{algorithms[selectedAlgos[0]]?.name}</strong>
                    <br />
                    CPU-only jobs: <strong>{algorithms[selectedAlgos[1]]?.name}</strong>
                    {selectedAlgos[2] && (
                      <>
                        <br />
                        Fallback: <strong>{algorithms[selectedAlgos[2]]?.name}</strong>
                      </>
                    )}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border flex justify-end gap-2">
          {showSuccess ? (
            <div className="flex-1 p-2 bg-green-50 border border-green-200 rounded-md text-center">
              <p className="text-sm text-green-700 font-medium">Fusion created! Adding algorithms to selection...</p>
            </div>
          ) : (
            <>
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm border border-input rounded-md text-foreground hover:bg-muted"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateFusion}
                disabled={selectedAlgos.length < 2 || !fusionName.trim()}
                className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-md hover:opacity-90 disabled:opacity-50"
              >
                Create Fusion
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default AlgorithmFusion;
