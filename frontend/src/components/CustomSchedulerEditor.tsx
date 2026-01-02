import React, { useState, useEffect } from 'react';
import { useAlgorithmStore } from '../stores/algorithmStore';
import * as api from '../api';

const CODE_EXAMPLES = {
  priority: `function schedule(readyJobs, runningJobs, cluster, now) {
  if (readyJobs.length === 0) return null;
  
  // Example: pick the job with highest priority
  return readyJobs.reduce((best, job) =>
    job.priority > best.priority ? job : best
  );
}`,

  deadlineHybrid: `function schedule(readyJobs, runningJobs, cluster, now) {
  if (readyJobs.length === 0) return null;

  const DEADLINE_WEIGHT = 2.0;
  const SRPT_WEIGHT = 1.0;

  function score(job) {
    const deadlineUrgency = job.deadline
      ? DEADLINE_WEIGHT / Math.max(1, job.deadline - now)
      : 0;
    const remainingUrgency = SRPT_WEIGHT / Math.max(1, job.remainingTime);
    return deadlineUrgency + remainingUrgency;
  }

  return readyJobs.reduce((best, job) =>
    score(job) > score(best) ? job : best
  );
}
schedule.preemptive = true;`,

  antiStarvation: `function schedule(readyJobs, runningJobs, cluster, now) {
  if (readyJobs.length === 0) return null;

  const STARVATION_THRESHOLD_MS = 10000; // 10 seconds

  function effectiveRemaining(job) {
    if (job.waitTime > STARVATION_THRESHOLD_MS) {
      return job.remainingTime * 0.5; // boost starving jobs
    }
    return job.remainingTime;
  }

  return readyJobs.reduce((best, job) =>
    effectiveRemaining(job) < effectiveRemaining(best) ? job : best
  );
}
schedule.preemptive = true;`,
};

interface CustomSchedulerEditorProps {
  onClose: () => void;
}

export const CustomSchedulerEditor: React.FC<CustomSchedulerEditorProps> = ({ onClose }) => {
  const {
    customScheduler,
    savedSchedulers,
    setCustomCode,
    setCustomName,
    setCustomPreemptive,
    setValidationResult,
    setSavedSchedulers,
    resetCustomScheduler,
  } = useAlgorithmStore();

  const [isValidating, setIsValidating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showExamples, setShowExamples] = useState(false);
  const [activeTab, setActiveTab] = useState<'editor' | 'saved'>('editor');
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    loadSavedSchedulers();
  }, []);

  const loadSavedSchedulers = async () => {
    try {
      setLoadError(null);
      const response = await api.listSchedulers();
      setSavedSchedulers(response.schedulers);
    } catch (err: any) {
      console.error('Failed to load saved schedulers:', err);
      // Don't crash - just show error and allow user to continue
      if (err.response?.status === 401) {
        setLoadError('Session expired. Please log in again.');
      } else {
        setLoadError('Failed to load saved schedulers. You can still create new ones.');
      }
      setSavedSchedulers([]);
    }
  };

  const handleValidate = async () => {
    setIsValidating(true);
    try {
      const response = await api.validateScheduler({ code: customScheduler.code });
      setValidationResult(response.errors, response.valid);
    } catch (err: any) {
      setValidationResult([{ message: err.message || 'Validation failed' }], false);
    } finally {
      setIsValidating(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      if (customScheduler.savedId) {
        await api.updateScheduler(
          customScheduler.savedId,
          customScheduler.name,
          customScheduler.code,
          customScheduler.isPreemptive
        );
      } else {
        const saved = await api.createScheduler(
          customScheduler.name,
          customScheduler.code,
          customScheduler.isPreemptive
        );
        useAlgorithmStore.getState().loadSavedScheduler({
          ...saved,
          code: customScheduler.code,
          is_preemptive: customScheduler.isPreemptive,
        });
      }
      await loadSavedSchedulers();
      alert('Scheduler saved successfully!');
    } catch (err: any) {
      alert(err.response?.data?.detail || err.message || 'Failed to save scheduler');
    } finally {
      setIsSaving(false);
    }
  };

  const handleLoadExample = (key: keyof typeof CODE_EXAMPLES) => {
    setCustomCode(CODE_EXAMPLES[key]);
    setValidationResult([], true);
  };

  const handleLoadSaved = (scheduler: typeof savedSchedulers[0]) => {
    useAlgorithmStore.getState().loadSavedScheduler(scheduler);
    setActiveTab('editor');
  };

  const handleDeleteSaved = async (schedulerId: string) => {
    if (!confirm('Are you sure you want to delete this scheduler?')) return;
    try {
      await api.deleteScheduler(schedulerId);
      await loadSavedSchedulers();
    } catch (err: any) {
      alert('Failed to delete scheduler');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-card border border-border rounded-lg w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-border flex justify-between items-center">
          <h3 className="text-lg font-semibold text-card-foreground">Custom Scheduler Editor</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            ✕
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border">
          <button
            onClick={() => setActiveTab('editor')}
            className={`px-4 py-2 text-sm font-medium ${
              activeTab === 'editor'
                ? 'text-primary border-b-2 border-primary'
                : 'text-muted-foreground'
            }`}
          >
            Editor
          </button>
          <button
            onClick={() => setActiveTab('saved')}
            className={`px-4 py-2 text-sm font-medium ${
              activeTab === 'saved'
                ? 'text-primary border-b-2 border-primary'
                : 'text-muted-foreground'
            }`}
          >
            My Saved Schedulers ({savedSchedulers.length})
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-4">
          {/* Error Message */}
          {loadError && (
            <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
              <p className="text-sm text-yellow-700">{loadError}</p>
            </div>
          )}
          
          {activeTab === 'editor' ? (
            <div className="space-y-4">
              {/* Name Input */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Scheduler Name
                </label>
                <input
                  type="text"
                  value={customScheduler.name}
                  onChange={(e) => setCustomName(e.target.value)}
                  className="w-full px-3 py-2 border border-input rounded-md bg-background text-foreground"
                  placeholder="My Custom Scheduler"
                />
              </div>

              {/* Code Editor */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Scheduling Logic (JavaScript)
                </label>
                <div className="border border-input rounded-md overflow-hidden">
                  <textarea
                    value={customScheduler.code}
                    onChange={(e) => {
                      setCustomCode(e.target.value);
                      setValidationResult([], true);
                    }}
                    className="w-full h-64 px-3 py-2 font-mono text-sm bg-background text-foreground resize-none"
                    placeholder="function schedule(readyJobs, runningJobs, cluster, now) { ... }"
                    spellCheck={false}
                  />
                </div>
              </div>

              {/* Preemptive Toggle */}
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="preemptive"
                  checked={customScheduler.isPreemptive}
                  onChange={(e) => setCustomPreemptive(e.target.checked)}
                  className="w-4 h-4"
                />
                <label htmlFor="preemptive" className="text-sm text-foreground">
                  Enable preemption (call scheduler on every job arrival)
                </label>
              </div>

              {/* Validation Errors */}
              {!customScheduler.isValid && customScheduler.validationErrors.length > 0 && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                  <p className="text-sm font-medium text-red-700 mb-1">Validation Errors:</p>
                  <ul className="text-xs text-red-600 space-y-1">
                    {customScheduler.validationErrors.map((err, i) => (
                      <li key={i}>
                        {err.line ? `Line ${err.line}: ` : ''}
                        {err.message}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Examples */}
              <div>
                <button
                  onClick={() => setShowExamples(!showExamples)}
                  className="text-sm text-primary hover:underline"
                >
                  {showExamples ? '▼' : '▶'} Code Examples
                </button>
                {showExamples && (
                  <div className="mt-2 space-y-2">
                    <button
                      onClick={() => handleLoadExample('priority')}
                      className="block w-full text-left px-3 py-2 text-sm bg-muted hover:bg-muted/80 rounded"
                    >
                      <strong>Strict Priority</strong> - Run highest priority jobs first
                    </button>
                    <button
                      onClick={() => handleLoadExample('deadlineHybrid')}
                      className="block w-full text-left px-3 py-2 text-sm bg-muted hover:bg-muted/80 rounded"
                    >
                      <strong>Deadline + SRPT Hybrid</strong> - Balance deadlines with remaining time
                    </button>
                    <button
                      onClick={() => handleLoadExample('antiStarvation')}
                      className="block w-full text-left px-3 py-2 text-sm bg-muted hover:bg-muted/80 rounded"
                    >
                      <strong>Anti-Starvation SRPT</strong> - Boost long-waiting jobs
                    </button>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {savedSchedulers.length === 0 ? (
                <p className="text-muted-foreground text-sm">No saved schedulers yet.</p>
              ) : (
                savedSchedulers.map((scheduler) => (
                  <div
                    key={scheduler.id}
                    className="p-3 border border-input rounded-md flex justify-between items-center"
                  >
                    <div>
                      <p className="font-medium text-foreground">{scheduler.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {scheduler.is_preemptive ? 'Preemptive' : 'Non-preemptive'} •{' '}
                        {new Date(scheduler.created_at || '').toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleLoadSaved(scheduler)}
                        className="px-3 py-1 text-sm bg-primary text-primary-foreground rounded hover:opacity-90"
                      >
                        Load
                      </button>
                      <button
                        onClick={() => handleDeleteSaved(scheduler.id)}
                        className="px-3 py-1 text-sm text-red-600 hover:bg-red-50 rounded"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border flex justify-between gap-2">
          <button
            onClick={resetCustomScheduler}
            className="px-4 py-2 text-sm border border-input rounded-md text-foreground hover:bg-muted"
          >
            Reset
          </button>
          <div className="flex gap-2">
            <button
              onClick={handleValidate}
              disabled={isValidating}
              className="px-4 py-2 text-sm border border-input rounded-md text-foreground hover:bg-muted disabled:opacity-50"
            >
              {isValidating ? 'Validating...' : 'Validate'}
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving || !customScheduler.isValid}
              className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-md hover:opacity-90 disabled:opacity-50"
            >
              {isSaving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CustomSchedulerEditor;
