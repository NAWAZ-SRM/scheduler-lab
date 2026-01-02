import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../stores/authStore'
import { useAlgorithmStore } from '../stores/algorithmStore'
import { useWorkloadStore } from '../stores/workloadStore'
import { useSimulationStore } from '../stores/simulationStore'
import { MetricsCards } from '../components/MetricsCards'
import { GanttChart } from '../components/GanttChart'
import { SupportingCharts } from '../components/SupportingCharts'
import { AlgorithmFusion } from '../components/AlgorithmFusion'
import * as api from '../api'

const LeftPanel: React.FC = () => {
  const { 
    preset, 
    totalJobs, 
    arrivalPattern, 
    arrivalRate,
    simulationWindow,
    durationMin,
    durationMax,
    setPreset,
    setField 
  } = useWorkloadStore()

  const presetOptions = [
    { value: 'web_api_server', label: 'Web API Server' },
    { value: 'ml_training_queue', label: 'ML Training Queue' },
    { value: 'video_transcoding', label: 'Video Transcoding' },
    { value: 'mixed_workload', label: 'Mixed Workload' },
    { value: 'stress_test', label: 'Stress Test' },
    { value: 'custom', label: 'Custom' },
  ]

  return (
    <div className="h-screen bg-card border-r border-border overflow-y-auto p-4">
      <h2 className="text-lg font-semibold text-card-foreground mb-4">Load Builder</h2>
      
      <div className="space-y-4">
        {/* Preset Selector */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-2">Scenario Preset</label>
          <select 
            value={preset}
            onChange={(e) => setPreset(e.target.value)}
            className="w-full px-3 py-2 border border-input rounded-md bg-background text-foreground"
          >
            {presetOptions.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>

        {/* Total Jobs */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-2">Number of Jobs: {totalJobs}</label>
          <input 
            type="range" 
            min="10"
            max="500"
            value={totalJobs}
            onChange={(e) => setField('totalJobs', parseInt(e.target.value))}
            className="w-full"
          />
        </div>

        {/* Arrival Pattern */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-2">Arrival Pattern</label>
          <select 
            value={arrivalPattern}
            onChange={(e) => setField('arrivalPattern', e.target.value)}
            className="w-full px-3 py-2 border border-input rounded-md bg-background text-foreground"
          >
            <option value="poisson">Poisson</option>
            <option value="uniform">Uniform</option>
            <option value="bursty">Bursty</option>
            <option value="periodic">Periodic</option>
          </select>
        </div>

        {/* Arrival Rate */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-2">Avg Arrivals/sec: {arrivalRate}</label>
          <input 
            type="range" 
            min="1"
            max="100"
            value={arrivalRate}
            onChange={(e) => setField('arrivalRate', parseInt(e.target.value))}
            className="w-full"
          />
        </div>

        {/* Simulation Window */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-2">Simulate for (seconds): {simulationWindow}</label>
          <input 
            type="range" 
            min="10"
            max="600"
            value={simulationWindow}
            onChange={(e) => setField('simulationWindow', parseInt(e.target.value))}
            className="w-full"
          />
        </div>

        {/* Duration Min */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-2">Min Job Duration (ms): {durationMin}</label>
          <input 
            type="range" 
            min="10"
            max="10000"
            value={durationMin}
            onChange={(e) => setField('durationMin', parseInt(e.target.value))}
            className="w-full"
          />
        </div>

        {/* Duration Max */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-2">Max Job Duration (ms): {durationMax}</label>
          <input 
            type="range" 
            min="100"
            max="600000"
            value={durationMax}
            onChange={(e) => setField('durationMax', parseInt(e.target.value))}
            className="w-full"
          />
        </div>

        {/* Workload Preview */}
        <div className="p-3 bg-muted rounded-md mt-4">
          <p className="text-sm font-medium text-foreground">Workload Preview</p>
          <p className="text-xs text-muted-foreground mt-1">
            ~{totalJobs} jobs, {simulationWindow}s simulation<br />
            Pattern: {arrivalPattern} (λ={arrivalRate}/s)<br />
            Duration: {durationMin}-{durationMax}ms
          </p>
        </div>
      </div>
    </div>
  )
}

const CenterPanel: React.FC = () => {
  const algorithms = useAlgorithmStore((state) => state.algorithms)
  const selectedAlgorithms = useAlgorithmStore((state) => state.selectedAlgorithms)
  const fusionConfigs = useAlgorithmStore((state) => state.fusionConfigs)
  const addAlgorithm = useAlgorithmStore((state) => state.addAlgorithm)
  const removeAlgorithm = useAlgorithmStore((state) => state.removeAlgorithm)
  const canAddMore = useAlgorithmStore((state) => state.canAddMore)
  
  const { buildWorkloadConfig } = useWorkloadStore()
  const { startSimulation, status } = useSimulationStore()
  
  const [showFusion, setShowFusion] = useState(false)

  const handleToggle = (algoId: string) => {
    if (selectedAlgorithms.find(a => a.id === algoId)) {
      removeAlgorithm(algoId)
    } else if (canAddMore()) {
      addAlgorithm(algoId)
    }
  }

  const handleRunSimulation = async () => {
    if (selectedAlgorithms.length === 0) {
      alert('Please select at least one algorithm')
      return
    }

    try {
      const workload = buildWorkloadConfig()
      
      await startSimulation({
        workload,
        algorithms: selectedAlgorithms,
        fusion: fusionConfigs.length > 0 ? fusionConfigs[fusionConfigs.length - 1] : undefined,
        global_params: {
          starvation_threshold: 30,
          preemption_cost: 0,
        },
      })
    } catch (err: any) {
      console.error('Failed to run simulation:', err)
      const errorMessage = err.response?.data?.detail || err.message || 'Failed to run simulation'
      alert(errorMessage)
    }
  }

  const isRunning = status === 'running'

  return (
    <div className="h-screen bg-card border-r border-border overflow-y-auto p-4">
      <h2 className="text-lg font-semibold text-card-foreground mb-4">Algorithm Selector</h2>
      <p className="text-sm text-muted-foreground mb-4">Select up to 3 algorithms to compare</p>
      
      <div className="space-y-2">
        {Object.values(algorithms).map((algo) => (
          <div 
            key={algo.id}
            className={`p-3 border rounded-md cursor-pointer transition-colors ${
              selectedAlgorithms.find(a => a.id === algo.id)
                ? 'bg-primary/10 border-primary'
                : 'bg-background border-input hover:bg-muted'
            }`}
            onClick={() => handleToggle(algo.id)}
          >
            <div className="flex items-center justify-between">
              <div className="font-medium">{algo.name}</div>
              {selectedAlgorithms.find(a => a.id === algo.id) && (
                <span className="text-xs bg-primary text-primary-foreground px-2 py-1 rounded">Selected</span>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1">{algo.description}</p>
          </div>
        ))}
      </div>

      {/* Fusion Button */}
      <div className="mt-4">
        <button 
          onClick={() => setShowFusion(true)}
          disabled={selectedAlgorithms.length < 2}
          className="w-full px-3 py-2 text-sm border border-input rounded-md bg-background text-foreground hover:bg-muted transition-colors disabled:opacity-50"
        >
          + Fuse Selected Algorithms ({selectedAlgorithms.length} selected)
        </button>
      </div>

      <button 
        className="w-full bg-primary text-primary-foreground py-3 rounded-md hover:opacity-90 font-medium mt-6 disabled:opacity-50"
        disabled={selectedAlgorithms.length === 0 || isRunning}
        onClick={handleRunSimulation}
      >
        {isRunning ? 'Running...' : 'Run Simulation'}
      </button>

      {/* Modals */}
      {showFusion && (
        <AlgorithmFusion onClose={() => setShowFusion(false)} />
      )}
    </div>
  )
}

interface RightPanelProps {
  isRunning?: boolean
  progress?: number
  progressMessage?: string
}

const RightPanel: React.FC<RightPanelProps> = ({ isRunning = false, progress = 0, progressMessage = '' }) => {
  const { currentRun, error, addPastRun } = useSimulationStore()
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [savedName, setSavedName] = useState('')
  const [showNameInput, setShowNameInput] = useState(false)
  const navigate = useNavigate()

  const handleSave = async () => {
    if (!currentRun) return
    
    if (!showNameInput) {
      setShowNameInput(true)
      setSavedName(`Run ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`)
      return
    }
    
    setIsSaving(true)
    setSaveError(null)
    
    try {
      const response = await api.saveSimulation({
        name: savedName,
        run_token: currentRun.id,
      })
      
      const savedRun = {
        ...currentRun,
        id: response.id,
        name: savedName,
        share_token: response.share_token,
      }
      
      addPastRun(savedRun)
      
      alert(`Saved! ID: ${response.id}`)
      setShowNameInput(false)
      navigate('/dashboard')
    } catch (err: any) {
      setSaveError(err.response?.data?.detail || err.message || 'Failed to save')
    } finally {
      setIsSaving(false)
    }
  }

  const handleShare = async () => {
    if (!currentRun) return
    
    try {
      const response = await api.saveSimulation({
        name: currentRun.name || 'Shared Run',
        run_token: currentRun.id,
      })
      
      const shareUrl = `${window.location.origin}/shared/${response.share_token}`
      await navigator.clipboard.writeText(shareUrl)
      alert('Share link copied to clipboard!')
    } catch (err: any) {
      alert('Failed to create share link')
    }
  }

  return (
    <div className="h-screen bg-card overflow-y-auto p-4">
      <h2 className="text-lg font-semibold text-card-foreground mb-4">Results</h2>
      
      {isRunning && (
        <div className="space-y-4 mb-6">
          <div>
            <p className="text-sm text-foreground mb-2">Simulation Progress</p>
            <div className="w-full bg-muted rounded-full h-2">
              <div 
                className="bg-primary h-2 rounded-full transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground mt-2">{progress}% - {progressMessage}</p>
          </div>
        </div>
      )}

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-md mb-4">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {!isRunning && !currentRun && !error && (
        <div className="text-center py-12">
          <p className="text-muted-foreground">Select algorithms and click "Run Simulation" to see results</p>
        </div>
      )}

      {currentRun && !isRunning && (
        <div className="space-y-6">
          {/* Success Message */}
          <div className="p-3 bg-green-50 border border-green-200 rounded-md">
            <p className="text-sm text-green-700 font-medium">Simulation Complete!</p>
            <p className="text-xs text-green-600 mt-1">
              {currentRun.results?.length || 0} algorithm(s) simulated
            </p>
          </div>

          {/* Section A: Metrics Cards */}
          <MetricsCards results={currentRun.results || []} />

          {/* Section B: Gantt Chart */}
          <GanttChart results={currentRun.results || []} />

          {/* Section C: Supporting Charts */}
          <SupportingCharts results={currentRun.results || []} />

          {/* Save/Share Section */}
          {saveError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-md">
              <p className="text-sm text-red-700">{saveError}</p>
            </div>
          )}
          
          {showNameInput && (
            <div className="p-3 border border-input rounded-md">
              <label className="block text-sm font-medium text-foreground mb-2">Simulation Name</label>
              <input 
                type="text"
                value={savedName}
                onChange={(e) => setSavedName(e.target.value)}
                className="w-full px-3 py-2 border border-input rounded-md bg-background text-foreground mb-2"
                placeholder="Enter a name for this run"
              />
              <div className="flex gap-2">
                <button 
                  onClick={handleSave}
                  disabled={isSaving || !savedName.trim()}
                  className="flex-1 bg-primary text-primary-foreground py-2 rounded-md hover:opacity-90 font-medium disabled:opacity-50"
                >
                  {isSaving ? 'Saving...' : 'Confirm Save'}
                </button>
                <button 
                  onClick={() => setShowNameInput(false)}
                  className="flex-1 border border-input bg-background text-foreground py-2 rounded-md hover:bg-muted font-medium"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
          
          {!showNameInput && (
            <div className="flex gap-4 pt-4 border-t">
              <button 
                onClick={handleSave}
                className="flex-1 bg-primary text-primary-foreground py-2 rounded-md hover:opacity-90 font-medium"
              >
                Save to Dashboard
              </button>
              <button 
                onClick={handleShare}
                className="flex-1 border border-input bg-background text-foreground py-2 rounded-md hover:bg-muted font-medium"
              >
                Share
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export const WorkbenchPage: React.FC = () => {
  const navigate = useNavigate()
  const user = useAuthStore((state) => state.user)
  const { status, progress, progressMessage } = useSimulationStore()

  if (!user) {
    navigate('/login')
    return null
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <div className="bg-card border-b border-border p-4 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Scheduling Workbench</h1>
          <p className="text-sm text-muted-foreground">Welcome, {user.username}</p>
        </div>
        <button 
          onClick={() => navigate('/dashboard')}
          className="px-4 py-2 text-foreground border border-border rounded-md hover:bg-muted"
        >
          Back to Dashboard
        </button>
      </div>

      {/* Main Grid Layout */}
      <div className="grid grid-cols-workbench h-[calc(100vh-70px)]">
        <LeftPanel />
        <CenterPanel />
        <RightPanel 
          isRunning={status === 'running'} 
          progress={progress} 
          progressMessage={progressMessage}
        />
      </div>
    </div>
  )
}
