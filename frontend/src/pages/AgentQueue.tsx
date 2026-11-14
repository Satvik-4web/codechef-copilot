import React, { useState } from 'react';
import type {
  AssignmentTask,
  AgentEvent,
  TaskAssistanceStatus,
  TaskMode,
} from '../types';
import {
  ListTodo,
  Play,
  Pause,
  RotateCcw,
  Trash2,
  OctagonAlert,
  ShieldCheck,
  ShieldAlert,
  ChevronRight,
  ExternalLink,
  FileCode2,
  Terminal,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Info,
} from 'lucide-react';

interface AgentQueueProps {
  tasks: AssignmentTask[];
  events: AgentEvent[];
  onStartTask: (taskId: number) => void;
  onPauseTask: (taskId: number) => void;
  onResumeTask: (taskId: number) => void;
  onCancelTask: (taskId: number) => void;
  onUpdatePermission: (
    taskId: number,
    status: TaskAssistanceStatus,
    autoSub: boolean,
    source: string,
    mode: TaskMode
  ) => void;
  onOpenWorkspaceForTask: (task: AssignmentTask) => void;
  onOpenSubmissionModal: (task: AssignmentTask) => void;
  onEmergencyStop: () => void;
  onClearQueue: () => void;
  isProcessing: boolean;
}

export const AgentQueuePage: React.FC<AgentQueueProps> = ({
  tasks,
  events,
  onStartTask,
  onPauseTask,
  onResumeTask,
  onCancelTask,
  onUpdatePermission,
  onOpenWorkspaceForTask,
  onOpenSubmissionModal,
  onEmergencyStop,
  onClearQueue,
  isProcessing,
}) => {
  const [editingPermTask, setEditingPermTask] = useState<AssignmentTask | null>(null);
  const [permStatus, setPermStatus] = useState<TaskAssistanceStatus>('unknown');
  const [permAutoSub, setPermAutoSub] = useState<boolean>(false);
  const [permSource, setPermSource] = useState<string>('');
  const [permMode, setPermMode] = useState<TaskMode>('learning');

  const openPermModal = (task: AssignmentTask) => {
    setEditingPermTask(task);
    setPermStatus(task.permission?.assistance_status || 'unknown');
    setPermAutoSub(task.permission?.automated_submission_allowed || false);
    setPermSource(task.permission?.permission_source || 'Verified by user');
    setPermMode(task.permission?.task_mode || 'learning');
  };

  const handleSavePerm = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingPermTask) {
      onUpdatePermission(editingPermTask.id, permStatus, permAutoSub, permSource, permMode);
      setEditingPermTask(null);
    }
  };

  // Stats
  const queuedCount = tasks.filter((t) => t.state === 'QUEUED').length;
  const activeCount = tasks.filter((t) =>
    ['OPENING_PROBLEM', 'PARSING_PROBLEM', 'ANALYZING', 'DRAFTING', 'COMPILING', 'TESTING', 'DEBUGGING', 'SUBMITTING'].includes(t.state)
  ).length;
  const reviewCount = tasks.filter((t) => t.state === 'READY_FOR_REVIEW').length;
  const completedCount = tasks.filter((t) => t.state === 'COMPLETED').length;
  const pausedCount = tasks.filter((t) => t.state === 'PAUSED').length;

  const getStateColor = (state: string) => {
    switch (state) {
      case 'COMPLETED':
        return 'bg-emerald-950/80 border-emerald-800 text-emerald-300';
      case 'READY_FOR_REVIEW':
        return 'bg-brand-950/80 border-brand-800 text-brand-accent';
      case 'FAILED':
        return 'bg-rose-950/80 border-rose-800 text-rose-300';
      case 'PAUSED':
        return 'bg-amber-950/80 border-amber-800 text-amber-300';
      case 'NEEDS_PERMISSION_CONFIRMATION':
        return 'bg-purple-950/80 border-purple-800 text-purple-300';
      case 'DRAFTING':
      case 'COMPILING':
      case 'TESTING':
      case 'ANALYZING':
        return 'bg-blue-950/80 border-blue-800 text-blue-300 animate-pulse';
      default:
        return 'bg-graphite-800 border-graphite-700 text-slate-300';
    }
  };

  return (
    <div className="flex-1 flex flex-col h-[calc(100vh-4rem)] overflow-hidden">
      {/* Queue Toolbar */}
      <div className="h-14 border-b border-graphite-750 bg-graphite-900 px-6 flex items-center justify-between select-none">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <ListTodo className="w-5 h-5 text-brand-accent" />
            <h2 className="text-sm font-bold text-white">Agent Task Queue</h2>
          </div>

          <div className="flex items-center space-x-1.5 text-xs text-slate-400 font-mono">
            <span className="px-2 py-0.5 rounded bg-graphite-800 border border-graphite-750">
              Active: <strong className="text-brand-accent">{activeCount}</strong>
            </span>
            <span className="px-2 py-0.5 rounded bg-graphite-800 border border-graphite-750">
              Queued: <strong className="text-slate-200">{queuedCount}</strong>
            </span>
            <span className="px-2 py-0.5 rounded bg-graphite-800 border border-graphite-750">
              Review: <strong className="text-amber-300">{reviewCount}</strong>
            </span>
            <span className="px-2 py-0.5 rounded bg-graphite-800 border border-graphite-750">
              Done: <strong className="text-emerald-400">{completedCount}</strong>
            </span>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={onClearQueue}
            disabled={tasks.length === 0}
            className="px-3 py-1.5 bg-graphite-800 hover:bg-graphite-750 text-slate-300 rounded text-xs font-medium border border-graphite-700 transition-colors disabled:opacity-40"
          >
            Clear Pending
          </button>

          <button
            onClick={onEmergencyStop}
            className="px-3 py-1.5 bg-rose-950/80 hover:bg-rose-900 text-rose-300 border border-rose-800 rounded text-xs font-semibold flex items-center space-x-1 transition-colors"
          >
            <OctagonAlert className="w-3.5 h-3.5" />
            <span>Emergency Stop</span>
          </button>
        </div>
      </div>

      {/* Main Content Area: Left Tasks (65%) + Right Live Events (35%) */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Task Cards List */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 border-r border-graphite-750">
          {tasks.length > 0 ? (
            tasks.map((task) => (
              <div
                key={task.id}
                className="bg-graphite-900 border border-graphite-750 rounded-xl p-4 space-y-3 shadow-sm hover:border-graphite-650 transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center space-x-2">
                      <h3 className="text-sm font-bold text-white">{task.title}</h3>
                      {task.course_group && (
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-graphite-800 text-slate-400 border border-graphite-700 font-mono">
                          {task.course_group}
                        </span>
                      )}
                    </div>
                    <a
                      href={task.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[11px] text-slate-500 hover:text-brand-accent flex items-center space-x-1 font-mono mt-0.5"
                    >
                      <span>{task.url}</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>

                  <div className="flex items-center space-x-2">
                    <span
                      className={`text-[11px] font-mono px-2.5 py-0.5 rounded-full border font-medium ${getStateColor(
                        task.state
                      )}`}
                    >
                      {task.state}
                    </span>
                  </div>
                </div>

                {/* Permission Bar */}
                <div className="flex items-center justify-between p-2.5 bg-graphite-850 rounded-lg border border-graphite-750 text-xs">
                  <div className="flex items-center space-x-2">
                    {task.permission?.assistance_status === 'ai_assistance_allowed' ? (
                      <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <ShieldAlert className="w-4 h-4 text-amber-400" />
                    )}
                    <span className="text-slate-300">
                      Permission:{' '}
                      <strong
                        className={
                          task.permission?.assistance_status === 'ai_assistance_allowed'
                            ? 'text-emerald-300'
                            : 'text-amber-300'
                        }
                      >
                        {task.permission?.assistance_status || 'unknown'}
                      </strong>
                    </span>
                    <span className="text-slate-500 font-mono text-[11px]">
                      ({task.permission?.task_mode || 'learning'})
                    </span>
                    {task.permission?.automated_submission_allowed && (
                      <span className="px-1.5 py-0.2 rounded bg-amber-950/60 border border-amber-800 text-amber-300 text-[10px] font-mono">
                        Auto-Submit Authorized
                      </span>
                    )}
                  </div>

                  <button
                    onClick={() => openPermModal(task)}
                    className="px-2 py-0.5 bg-graphite-800 hover:bg-graphite-750 text-slate-300 rounded text-[11px] border border-graphite-700 transition-colors"
                  >
                    Configure Permission
                  </button>
                </div>

                {/* Error diagnostics if present */}
                {task.last_error && (
                  <div className="p-2.5 bg-rose-950/30 border border-rose-800/40 rounded-lg text-rose-300 text-xs flex items-start space-x-2">
                    <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    <span>{task.last_error}</span>
                  </div>
                )}

                {/* Actions Bar */}
                <div className="flex items-center justify-between pt-1 text-xs">
                  <button
                    onClick={() => onOpenWorkspaceForTask(task)}
                    className="text-brand-accent hover:underline flex items-center space-x-1"
                  >
                    <FileCode2 className="w-3.5 h-3.5" />
                    <span>Open in Workspace</span>
                  </button>

                  <div className="flex items-center space-x-2">
                    {task.state === 'READY_FOR_REVIEW' && (
                      <button
                        onClick={() => onOpenSubmissionModal(task)}
                        className="px-3 py-1 bg-brand-600 hover:bg-brand-500 text-white rounded font-medium flex items-center space-x-1 transition-colors"
                      >
                        <ShieldCheck className="w-3.5 h-3.5" />
                        <span>Review & Submit</span>
                      </button>
                    )}

                    {['QUEUED', 'PAUSED', 'FAILED', 'DISCOVERED', 'NEEDS_PERMISSION_CONFIRMATION'].includes(task.state) && (
                      <button
                        onClick={() => onStartTask(task.id)}
                        disabled={isProcessing}
                        className="px-3 py-1 bg-brand-600 hover:bg-brand-500 text-white rounded font-medium flex items-center space-x-1 transition-colors disabled:opacity-50"
                      >
                        <Play className="w-3.5 h-3.5 fill-current" />
                        <span>Process Task</span>
                      </button>
                    )}

                    {['OPENING_PROBLEM', 'PARSING_PROBLEM', 'ANALYZING', 'DRAFTING', 'COMPILING', 'TESTING'].includes(task.state) && (
                      <button
                        onClick={() => onPauseTask(task.id)}
                        className="px-3 py-1 bg-amber-600 hover:bg-amber-500 text-white rounded font-medium flex items-center space-x-1 transition-colors"
                      >
                        <Pause className="w-3.5 h-3.5" />
                        <span>Pause</span>
                      </button>
                    )}

                    {task.state !== 'CANCELLED' && (
                      <button
                        onClick={() => onCancelTask(task.id)}
                        className="p-1 hover:bg-graphite-800 text-slate-500 hover:text-rose-400 rounded transition-colors"
                        title="Cancel task"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="p-12 text-center text-slate-500 text-xs space-y-2">
              <ListTodo className="w-10 h-10 text-slate-600 mx-auto" />
              <p className="font-medium text-slate-400">Queue is empty</p>
              <p className="text-[11px] text-slate-500 max-w-sm mx-auto">
                Navigate to <strong>Discovery</strong> to scan your CodeChef page and select tasks to place into the queue.
              </p>
            </div>
          )}
        </div>

        {/* Right: Live Event Stream Sidebar */}
        <div className="w-[380px] bg-graphite-950 p-4 flex flex-col overflow-hidden border-l border-graphite-750">
          <div className="flex items-center space-x-2 text-xs font-bold text-slate-300 pb-3 border-b border-graphite-750 uppercase tracking-wider">
            <Terminal className="w-4 h-4 text-brand-accent" />
            <span>Audit Event Log & Live Stream</span>
          </div>

          <div className="flex-1 overflow-y-auto space-y-3 pt-3">
            {events.length > 0 ? (
              events.map((evt) => (
                <div
                  key={evt.id}
                  className="p-2.5 bg-graphite-900 border border-graphite-750 rounded-lg text-xs space-y-1 font-mono"
                >
                  <div className="flex items-center justify-between text-[10px] text-slate-500">
                    <span className="text-brand-accent font-semibold">{evt.event_type}</span>
                    <span>{new Date(evt.created_at).toLocaleTimeString()}</span>
                  </div>
                  <p className="text-slate-300 text-[11px] leading-tight font-sans">
                    {evt.message}
                  </p>
                </div>
              ))
            ) : (
              <div className="text-slate-600 text-xs italic text-center p-8">
                No events recorded yet.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Permission Update Dialog Modal */}
      {editingPermTask && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-graphite-900 border border-graphite-700 rounded-xl max-w-md w-full overflow-hidden shadow-2xl p-5 space-y-4 text-xs">
            <div className="flex items-center space-x-2 text-sm font-bold text-slate-100">
              <ShieldCheck className="w-5 h-5 text-brand-accent" />
              <span>Configure Academic Integrity Permissions</span>
            </div>

            <p className="text-[11px] text-slate-400">
              Task: <strong className="text-slate-200">{editingPermTask.title}</strong>
            </p>

            <form onSubmit={handleSavePerm} className="space-y-4">
              <div className="space-y-2">
                <label className="block text-slate-300 font-semibold">Assistance Status</label>
                <div className="space-y-1.5">
                  <label className="flex items-center space-x-2 text-slate-300 cursor-pointer">
                    <input
                      type="radio"
                      name="perm_status"
                      checked={permStatus === 'unknown'}
                      onChange={() => {
                        setPermStatus('unknown');
                        setPermMode('learning');
                      }}
                      className="text-brand-600"
                    />
                    <span>Unknown (Default — Learning support only)</span>
                  </label>
                  <label className="flex items-center space-x-2 text-slate-300 cursor-pointer">
                    <input
                      type="radio"
                      name="perm_status"
                      checked={permStatus === 'learning_only'}
                      onChange={() => {
                        setPermStatus('learning_only');
                        setPermMode('learning');
                      }}
                      className="text-brand-600"
                    />
                    <span>Learning Only (Coursework / Graded — No full solutions)</span>
                  </label>
                  <label className="flex items-center space-x-2 text-slate-300 cursor-pointer">
                    <input
                      type="radio"
                      name="perm_status"
                      checked={permStatus === 'ai_assistance_allowed'}
                      onChange={() => {
                        setPermStatus('ai_assistance_allowed');
                        setPermMode('authorized_practice');
                      }}
                      className="text-brand-600"
                    />
                    <span>AI Assistance Allowed (Authorized Practice)</span>
                  </label>
                </div>
              </div>

              <div className="p-3 bg-graphite-850 rounded border border-graphite-750 space-y-2">
                <label className="flex items-start space-x-2 text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={permAutoSub}
                    onChange={(e) => setPermAutoSub(e.target.checked)}
                    className="mt-0.5 text-brand-600 rounded bg-graphite-900 border-graphite-700"
                  />
                  <div>
                    <span className="font-semibold block text-slate-200">
                      Enable Automated Submission
                    </span>
                    <span className="text-[10px] text-slate-400">
                      Disabled by default. Every submission still requires a fresh, one-time confirmation immediately prior to browser action.
                    </span>
                  </div>
                </label>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Permission Source / Notes</label>
                <input
                  type="text"
                  value={permSource}
                  onChange={(e) => setPermSource(e.target.value)}
                  placeholder="e.g. CodeChef practice problem; AI authorized by student"
                  className="w-full bg-graphite-850 border border-graphite-750 rounded p-2 text-slate-200"
                  required
                />
              </div>

              <div className="pt-2 flex justify-end space-x-2 border-t border-graphite-750">
                <button
                  type="button"
                  onClick={() => setEditingPermTask(null)}
                  className="px-3 py-1.5 bg-graphite-800 hover:bg-graphite-750 text-slate-300 rounded"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-brand-600 hover:bg-brand-500 text-white rounded font-semibold"
                >
                  Save & Enforce Permission
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
