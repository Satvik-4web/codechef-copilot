import React, { useState } from 'react';
import type { AssignmentBatch, AssignmentTask } from '../types';
import {
  Compass,
  CheckSquare,
  Square,
  ShieldAlert,
  ArrowRight,
  ExternalLink,
  Layers,
  Sparkles,
  Info,
} from 'lucide-react';

interface DiscoveryProps {
  currentBatch: AssignmentBatch | null;
  onScanPage: () => void;
  isScanning: boolean;
  onQueueSelected: (batchId: number, taskIds: number[]) => void;
  isQueueing: boolean;
  onNavigateToQueue: () => void;
}

export const DiscoveryPage: React.FC<DiscoveryProps> = ({
  currentBatch,
  onScanPage,
  isScanning,
  onQueueSelected,
  isQueueing,
  onNavigateToQueue,
}) => {
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  const tasks = currentBatch?.tasks || [];

  const handleToggleSelect = (id: number) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter((x) => x !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  const handleSelectAll = () => {
    if (selectedIds.length === tasks.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(tasks.map((t) => t.id));
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6 max-w-6xl mx-auto w-full">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-graphite-900 to-graphite-850 p-6 rounded-xl border border-graphite-750 shadow-lg flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2 text-brand-accent text-xs font-semibold uppercase tracking-wider mb-1">
            <Compass className="w-4 h-4" />
            <span>Task Discovery Engine</span>
          </div>
          <h1 className="text-xl font-bold text-white tracking-tight">
            Discover CodeChef Practice & Assignment Tasks
          </h1>
          <p className="text-slate-400 text-xs mt-1 max-w-2xl leading-relaxed">
            Scan your active CodeChef browser page to discover visible problem rows, assignment modules, and practice lists. Inspect them before placing them into the autonomous agent queue.
          </p>
        </div>

        <button
          onClick={onScanPage}
          disabled={isScanning}
          className="px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white rounded-lg text-xs font-semibold flex items-center space-x-2 transition-all shadow-md shadow-brand-500/20 disabled:opacity-50"
        >
          <Compass className={`w-4 h-4 ${isScanning ? 'animate-spin' : ''}`} />
          <span>{isScanning ? 'Scanning Browser DOM...' : 'Scan Active Browser Page'}</span>
        </button>
      </div>

      {/* Mandatory Integrity Disclosure */}
      <div className="p-3.5 bg-brand-950/30 border border-brand-800/40 rounded-xl text-xs text-slate-300 flex items-start space-x-3">
        <Info className="w-4 h-4 text-brand-accent flex-shrink-0 mt-0.5" />
        <div>
          <span className="font-semibold text-slate-200">
            Per-Task Academic Integrity Safeguard:
          </span>
          <p className="text-[11px] text-slate-400 mt-0.5">
            All newly discovered tasks default to <strong>unknown permission</strong> and <strong>learning-only mode</strong>. Full-solution drafting and automated submissions are strictly disabled until you explicitly verify that AI assistance is permitted for that specific task.
          </p>
        </div>
      </div>

      {/* Discovered Tasks Table */}
      <div className="bg-graphite-900 rounded-xl border border-graphite-750 overflow-hidden shadow-sm">
        {/* Table Toolbar */}
        <div className="p-4 border-b border-graphite-750 bg-graphite-850 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <button
              onClick={handleSelectAll}
              disabled={tasks.length === 0}
              className="flex items-center space-x-1.5 text-xs text-slate-300 hover:text-white font-medium disabled:opacity-50"
            >
              {selectedIds.length > 0 && selectedIds.length === tasks.length ? (
                <CheckSquare className="w-4 h-4 text-brand-accent" />
              ) : (
                <Square className="w-4 h-4 text-slate-500" />
              )}
              <span>Select All ({tasks.length})</span>
            </button>

            {currentBatch?.source_url && (
              <span className="text-[11px] text-slate-500 font-mono truncate max-w-[350px]">
                Source: {currentBatch.source_url}
              </span>
            )}
          </div>

          <div className="flex items-center space-x-3">
            <span className="text-xs text-slate-400">
              Selected: <strong className="text-slate-200">{selectedIds.length}</strong>
            </span>

            <button
              onClick={() => currentBatch && onQueueSelected(currentBatch.id, selectedIds)}
              disabled={selectedIds.length === 0 || isQueueing || !currentBatch}
              className="px-3 py-1.5 bg-brand-600 hover:bg-brand-500 text-white rounded text-xs font-semibold flex items-center space-x-1.5 transition-colors disabled:opacity-40"
            >
              <span>{isQueueing ? 'Queueing Tasks...' : 'Queue Selected Tasks'}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Task Rows */}
        <div className="divide-y divide-graphite-750 max-h-[550px] overflow-y-auto">
          {tasks.length > 0 ? (
            tasks.map((task: AssignmentTask) => {
              const isSelected = selectedIds.includes(task.id);
              return (
                <div
                  key={task.id}
                  onClick={() => handleToggleSelect(task.id)}
                  className={`p-3.5 flex items-center justify-between text-xs cursor-pointer transition-colors ${
                    isSelected ? 'bg-graphite-800/80' : 'hover:bg-graphite-850/60'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleSelect(task.id);
                      }}
                      className="text-slate-400 hover:text-white"
                    >
                      {isSelected ? (
                        <CheckSquare className="w-4 h-4 text-brand-accent" />
                      ) : (
                        <Square className="w-4 h-4 text-slate-600" />
                      )}
                    </button>

                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-semibold text-slate-200">{task.title}</span>
                        {task.course_group && (
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-graphite-800 text-slate-400 border border-graphite-700">
                            {task.course_group}
                          </span>
                        )}
                      </div>
                      <a
                        href={task.url}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="text-[11px] text-slate-500 hover:text-brand-accent flex items-center space-x-1 font-mono mt-0.5"
                      >
                        <span className="truncate max-w-[400px]">{task.url}</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  </div>

                  <div className="flex items-center space-x-3">
                    <span
                      className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${
                        task.visible_status === 'Solved'
                          ? 'bg-emerald-950/60 border-emerald-800 text-emerald-400'
                          : task.visible_status === 'Partially Solved'
                          ? 'bg-amber-950/60 border-amber-800 text-amber-400'
                          : 'bg-graphite-800 border-graphite-700 text-slate-400'
                      }`}
                    >
                      {task.visible_status}
                    </span>

                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-brand-950/40 border border-brand-800/60 text-brand-accent">
                      {task.permission?.assistance_status || 'unknown'}
                    </span>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="p-12 text-center text-slate-500 text-xs space-y-2">
              <Layers className="w-10 h-10 text-slate-600 mx-auto" />
              <p className="font-medium text-slate-400">No tasks discovered yet.</p>
              <p className="text-[11px] text-slate-500 max-w-sm mx-auto">
                Open a CodeChef practice page or assignment listing in your dedicated browser window, then click &quot;Scan Active Browser Page&quot; above.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
