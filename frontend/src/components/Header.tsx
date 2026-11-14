import React from 'react';
import type {
  AppMode,
  BrowserStatus,
  Problem,
} from '../types';
import {
  Globe,
  Camera,
  Square,
  GraduationCap,
  Sparkles,
  Settings,
  History,
  FileCode2,
  Compass,
  ListTodo,
  OctagonAlert,
} from 'lucide-react';

interface HeaderProps {
  mode: AppMode;
  onModeChange: (mode: AppMode) => void;
  browserStatus: BrowserStatus | null;
  onLaunchBrowser: () => void;
  onCloseBrowser: () => void;
  onCapturePage: () => void;
  isCapturing: boolean;
  activeProblem: Problem | null;
  onOpenManualModal: () => void;
  currentView: 'dashboard' | 'discovery' | 'queue' | 'workspace' | 'history' | 'settings';
  setCurrentView: (view: 'dashboard' | 'discovery' | 'queue' | 'workspace' | 'history' | 'settings') => void;
  onEmergencyStop: () => void;
  queuedTasksCount?: number;
}

export const Header: React.FC<HeaderProps> = ({
  mode,
  onModeChange,
  browserStatus,
  onLaunchBrowser,
  onCloseBrowser,
  onCapturePage,
  isCapturing,
  activeProblem,
  onOpenManualModal,
  currentView,
  setCurrentView,
  onEmergencyStop,
  queuedTasksCount = 0,
}) => {
  return (
    <header className="h-16 border-b border-graphite-750 bg-graphite-900 px-4 flex items-center justify-between select-none">
      {/* Brand & Navigation */}
      <div className="flex items-center space-x-6">
        <div
          onClick={() => setCurrentView('dashboard')}
          className="flex items-center space-x-2.5 cursor-pointer group"
        >
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-brand-600 to-brand-accent flex items-center justify-center text-white font-bold shadow-md shadow-brand-500/10">
            CC
          </div>
          <div>
            <div className="text-sm font-bold tracking-tight text-slate-100 flex items-center space-x-1.5">
              <span>CodeChef Copilot</span>
              <span className="text-[10px] uppercase font-mono px-1.5 py-0.2 rounded bg-brand-950 text-brand-accent border border-brand-800">
                Agent
              </span>
            </div>
            <div className="text-[11px] text-slate-400 font-medium">Autonomous Practice Companion</div>
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="hidden md:flex items-center space-x-1">
          <button
            onClick={() => setCurrentView('dashboard')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              currentView === 'dashboard'
                ? 'bg-graphite-800 text-slate-100 border border-graphite-700'
                : 'text-slate-400 hover:text-slate-200 hover:bg-graphite-850'
            }`}
          >
            Dashboard
          </button>
          <button
            onClick={() => setCurrentView('discovery')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center space-x-1.5 ${
              currentView === 'discovery'
                ? 'bg-graphite-800 text-slate-100 border border-graphite-700'
                : 'text-slate-400 hover:text-slate-200 hover:bg-graphite-850'
            }`}
          >
            <Compass className="w-3.5 h-3.5" />
            <span>Discovery</span>
          </button>
          <button
            onClick={() => setCurrentView('queue')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center space-x-1.5 ${
              currentView === 'queue'
                ? 'bg-graphite-800 text-slate-100 border border-graphite-700'
                : 'text-slate-400 hover:text-slate-200 hover:bg-graphite-850'
            }`}
          >
            <ListTodo className="w-3.5 h-3.5" />
            <span>Agent Queue</span>
            {queuedTasksCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-brand-600 text-white font-mono">
                {queuedTasksCount}
              </span>
            )}
          </button>
          <button
            onClick={() => setCurrentView('workspace')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center space-x-1.5 ${
              currentView === 'workspace'
                ? 'bg-graphite-800 text-slate-100 border border-graphite-700'
                : 'text-slate-400 hover:text-slate-200 hover:bg-graphite-850'
            }`}
          >
            <FileCode2 className="w-3.5 h-3.5" />
            <span>Workspace</span>
            {activeProblem && (
              <span className="max-w-[100px] truncate text-[10px] text-brand-accent">
                ({activeProblem.title})
              </span>
            )}
          </button>
          <button
            onClick={() => setCurrentView('history')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center space-x-1.5 ${
              currentView === 'history'
                ? 'bg-graphite-800 text-slate-100 border border-graphite-700'
                : 'text-slate-400 hover:text-slate-200 hover:bg-graphite-850'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>History</span>
          </button>
          <button
            onClick={() => setCurrentView('settings')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center space-x-1.5 ${
              currentView === 'settings'
                ? 'bg-graphite-800 text-slate-100 border border-graphite-700'
                : 'text-slate-400 hover:text-slate-200 hover:bg-graphite-850'
            }`}
          >
            <Settings className="w-3.5 h-3.5" />
            <span>Settings</span>
          </button>
        </nav>
      </div>

      {/* Mode Selector & Controls */}
      <div className="flex items-center space-x-3">
        {/* Emergency Stop Button */}
        <button
          onClick={onEmergencyStop}
          className="px-2.5 py-1 bg-rose-950/80 hover:bg-rose-900 border border-rose-800 text-rose-300 rounded-lg text-xs font-semibold flex items-center space-x-1 transition-colors"
          title="Emergency Stop: Immediately pauses all active agent tasks, executions, and browser actions"
        >
          <OctagonAlert className="w-3.5 h-3.5 text-rose-400" />
          <span className="hidden sm:inline">Emergency Stop</span>
        </button>

        {/* Mode Selector */}
        <div className="flex items-center bg-graphite-950 p-0.5 rounded-lg border border-graphite-750">
          <button
            onClick={() => onModeChange('learning')}
            className={`flex items-center space-x-1.5 px-3 py-1 rounded-md text-xs font-medium transition-all ${
              mode === 'learning'
                ? 'bg-brand-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            title="Learning Mode (Default): Explanations, graduated hints, and code review. Full solution generation blocked."
          >
            <GraduationCap className="w-3.5 h-3.5" />
            <span>Learning</span>
          </button>
          <button
            onClick={() => onModeChange('practice')}
            className={`flex items-center space-x-1.5 px-3 py-1 rounded-md text-xs font-medium transition-all ${
              mode === 'practice'
                ? 'bg-amber-600/90 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            title="Practice Mode: Code generation allowed only for verified practice tasks."
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Practice</span>
          </button>
        </div>

        {/* Dedicated Browser Status Pill */}
        <div className="flex items-center space-x-2 bg-graphite-850 px-2.5 py-1 rounded-lg border border-graphite-750 text-xs">
          <div className="flex items-center space-x-1.5">
            <span
              className={`w-2 h-2 rounded-full ${
                browserStatus?.running
                  ? browserStatus.is_challenge_detected
                    ? 'bg-amber-400 animate-pulse'
                    : 'bg-emerald-400'
                  : 'bg-slate-500'
              }`}
            />
            <span className="text-slate-300 font-mono text-[11px]">
              {browserStatus?.running
                ? browserStatus.is_challenge_detected
                  ? 'Challenge Detected'
                  : 'Browser Active'
                : 'Browser Offline'}
            </span>
          </div>

          <div className="border-l border-graphite-700 pl-2 flex items-center space-x-1">
            {browserStatus?.running ? (
              <>
                <button
                  onClick={onCapturePage}
                  disabled={isCapturing}
                  className="px-2 py-0.5 bg-brand-600 hover:bg-brand-500 text-white rounded text-[11px] font-medium flex items-center space-x-1 transition-colors disabled:opacity-50"
                  title="Capture current problem page from browser"
                >
                  <Camera className="w-3 h-3" />
                  <span>{isCapturing ? 'Capturing...' : 'Capture'}</span>
                </button>
                <button
                  onClick={onCloseBrowser}
                  className="p-1 hover:bg-graphite-700 text-slate-400 hover:text-rose-400 rounded transition-colors"
                  title="Close dedicated browser window"
                >
                  <Square className="w-3 h-3" />
                </button>
              </>
            ) : (
              <button
                onClick={onLaunchBrowser}
                className="px-2 py-0.5 bg-graphite-750 hover:bg-graphite-700 text-slate-200 rounded text-[11px] font-medium flex items-center space-x-1 transition-colors"
                title="Launch dedicated visible browser profile"
              >
                <Globe className="w-3 h-3 text-brand-accent" />
                <span>Launch</span>
              </button>
            )}
          </div>
        </div>

        {/* Manual Problem Paste Button */}
        <button
          onClick={onOpenManualModal}
          className="px-2.5 py-1 bg-graphite-800 hover:bg-graphite-750 text-slate-300 border border-graphite-700 rounded-lg text-xs font-medium transition-colors"
          title="Manually paste or edit problem statement"
        >
          Manual Task
        </button>
      </div>
    </header>
  );
};
