import React from 'react';
import {
  AppMode,
  BrowserStatus,
  Problem,
  HistoryData,
  UserSettings,
} from '../types';
import {
  Globe,
  Camera,
  Play,
  Square,
  ShieldCheck,
  AlertTriangle,
  GraduationCap,
  Sparkles,
  Server,
  FileCode2,
  ExternalLink,
  ChevronRight,
  Clock,
  History,
  CheckCircle2,
  XCircle,
} from 'lucide-react';

interface DashboardProps {
  mode: AppMode;
  onModeChange: (mode: AppMode) => void;
  browserStatus: BrowserStatus | null;
  onLaunchBrowser: () => void;
  onCloseBrowser: () => void;
  onCapturePage: () => void;
  isCapturing: boolean;
  activeProblem: Problem | null;
  onSelectProblem: (p: Problem) => void;
  history: HistoryData | null;
  settings: UserSettings | null;
  onOpenWorkspace: () => void;
  onOpenManualModal: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  mode,
  onModeChange,
  browserStatus,
  onLaunchBrowser,
  onCloseBrowser,
  onCapturePage,
  isCapturing,
  activeProblem,
  onSelectProblem,
  history,
  settings,
  onOpenWorkspace,
  onOpenManualModal,
}) => {
  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6 max-w-7xl mx-auto w-full">
      {/* Top Banner / Welcome */}
      <div className="bg-gradient-to-r from-graphite-900 to-graphite-850 p-6 rounded-xl border border-graphite-750 shadow-lg flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2 text-brand-accent text-xs font-semibold uppercase tracking-wider mb-1">
            <ShieldCheck className="w-4 h-4" />
            <span>Educational Coding Companion</span>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            CodeChef Copilot
          </h1>
          <p className="text-slate-400 text-xs mt-1 max-w-2xl leading-relaxed">
            Transparent, local-first companion for CodeChef practice tasks. Inspect problems through a dedicated browser profile, understand constraints, test in an isolated Docker sandbox, and submit manually with confidence.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          {activeProblem ? (
            <button
              onClick={onOpenWorkspace}
              className="px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white rounded-lg text-xs font-semibold flex items-center space-x-2 transition-all shadow-md shadow-brand-500/20"
            >
              <FileCode2 className="w-4 h-4" />
              <span>Continue Problem Workspace</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={onOpenManualModal}
              className="px-4 py-2 bg-graphite-750 hover:bg-graphite-700 text-white rounded-lg text-xs font-semibold flex items-center space-x-2 transition-colors border border-graphite-650"
            >
              <FileCode2 className="w-4 h-4" />
              <span>Paste Problem Manually</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Grid: Dedicated Browser Controller & Active Problem */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Card 1: Dedicated Browser Controller */}
        <div className="bg-graphite-900 p-5 rounded-xl border border-graphite-750 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2.5">
              <Globe className="w-5 h-5 text-brand-accent" />
              <h3 className="text-sm font-bold text-slate-100">
                Dedicated Browser Controller
              </h3>
            </div>
            <span
              className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${
                browserStatus?.running
                  ? browserStatus.is_challenge_detected
                    ? 'bg-amber-950/60 border-amber-800 text-amber-400'
                    : 'bg-emerald-950/60 border-emerald-800 text-emerald-400'
                  : 'bg-slate-900 border-slate-700 text-slate-400'
              }`}
            >
              {browserStatus?.running ? 'Running' : 'Disconnected'}
            </span>
          </div>

          <p className="text-xs text-slate-400 leading-relaxed">
            Runs a separate, persistent Chromium profile (<code className="text-slate-300 font-mono text-[11px]">.codechef_profile</code>). Your everyday browser profile is never touched. You log into CodeChef yourself.
          </p>

          {/* Browser State Details */}
          <div className="bg-graphite-850 p-3 rounded-lg border border-graphite-750 space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Current URL:</span>
              <span className="font-mono text-slate-200 truncate max-w-[280px]">
                {browserStatus?.current_url || 'None (Browser Closed)'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Page Title:</span>
              <span className="font-medium text-slate-200 truncate max-w-[280px]">
                {browserStatus?.current_title || 'N/A'}
              </span>
            </div>
            {browserStatus?.is_challenge_detected && (
              <div className="p-2 bg-amber-950/40 border border-amber-800 rounded text-amber-300 text-[11px] flex items-center space-x-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                <span>Security challenge / CAPTCHA detected. Complete it manually in the Chromium window.</span>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center space-x-3 pt-1">
            {browserStatus?.running ? (
              <>
                <button
                  onClick={onCapturePage}
                  disabled={isCapturing}
                  className="flex-1 py-2 bg-brand-600 hover:bg-brand-500 text-white rounded-lg text-xs font-semibold flex items-center justify-center space-x-1.5 transition-colors disabled:opacity-50"
                >
                  <Camera className="w-4 h-4" />
                  <span>{isCapturing ? 'Inspecting DOM...' : 'Capture Active Problem'}</span>
                </button>
                <button
                  onClick={onCloseBrowser}
                  className="px-4 py-2 bg-graphite-800 hover:bg-graphite-750 text-slate-300 hover:text-rose-400 rounded-lg text-xs font-medium border border-graphite-700 transition-colors"
                >
                  Close Window
                </button>
              </>
            ) : (
              <button
                onClick={onLaunchBrowser}
                className="w-full py-2 bg-brand-600 hover:bg-brand-500 text-white rounded-lg text-xs font-semibold flex items-center justify-center space-x-2 transition-colors"
              >
                <Globe className="w-4 h-4" />
                <span>Launch Dedicated Browser</span>
              </button>
            )}
          </div>
        </div>

        {/* Card 2: Active Problem & Workspace Launcher */}
        <div className="bg-graphite-900 p-5 rounded-xl border border-graphite-750 space-y-4 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <FileCode2 className="w-5 h-5 text-brand-accent" />
                <h3 className="text-sm font-bold text-slate-100">
                  Active Practice Task
                </h3>
              </div>
              {activeProblem && (
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-brand-950/60 border border-brand-800 text-brand-accent">
                  {Math.round(activeProblem.parser_confidence * 100)}% Confidence
                </span>
              )}
            </div>

            {activeProblem ? (
              <div className="bg-graphite-850 p-4 rounded-lg border border-graphite-750 space-y-2">
                <h4 className="text-sm font-bold text-white">
                  {activeProblem.title}
                </h4>
                <p className="text-xs text-slate-400 line-clamp-3 leading-relaxed">
                  {activeProblem.statement}
                </p>
                <div className="flex items-center space-x-4 text-[11px] text-slate-400 pt-1 font-mono">
                  <span>Samples: {activeProblem.examples?.length || 0}</span>
                  {activeProblem.source_url && (
                    <a
                      href={activeProblem.source_url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-brand-accent hover:underline flex items-center space-x-1"
                    >
                      <span>CodeChef</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              </div>
            ) : (
              <div className="bg-graphite-850/60 p-6 rounded-lg border border-graphite-750 text-center space-y-2">
                <p className="text-xs text-slate-400">
                  No active problem loaded yet.
                </p>
                <p className="text-[11px] text-slate-500">
                  Launch the browser and navigate to a problem, or click &quot;Paste Problem Manually&quot; to begin.
                </p>
              </div>
            )}
          </div>

          <div className="flex items-center space-x-3 pt-2">
            {activeProblem && (
              <button
                onClick={onOpenWorkspace}
                className="flex-1 py-2 bg-brand-600 hover:bg-brand-500 text-white rounded-lg text-xs font-semibold flex items-center justify-center space-x-2 transition-colors shadow-sm"
              >
                <span>Open in Monaco Workspace</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={onOpenManualModal}
              className="px-4 py-2 bg-graphite-800 hover:bg-graphite-750 text-slate-300 rounded-lg text-xs font-medium border border-graphite-700 transition-colors"
            >
              Manual Input
            </button>
          </div>
        </div>
      </div>

      {/* Non-Negotiable Safety & Integrity Directives */}
      <div className="bg-graphite-900 p-5 rounded-xl border border-graphite-750 space-y-3">
        <div className="flex items-center space-x-2 text-slate-200">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <h3 className="text-xs font-bold uppercase tracking-wider">
            Academic Integrity & Safe Execution Standards
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs text-slate-400 leading-relaxed">
          <div className="bg-graphite-850 p-3 rounded-lg border border-graphite-750/70">
            <span className="font-semibold text-slate-200 block mb-1">
              1. Strictly Manual Submissions
            </span>
            CodeChef Copilot never submits solutions automatically. You review your code and submit on CodeChef manually.
          </div>
          <div className="bg-graphite-850 p-3 rounded-lg border border-graphite-750/70">
            <span className="font-semibold text-slate-200 block mb-1">
              2. Learning Mode Guard
            </span>
            Learning mode is default. Complete answers are disabled for graded tasks. Graduated hints and reviews guide your own code.
          </div>
          <div className="bg-graphite-850 p-3 rounded-lg border border-graphite-750/70">
            <span className="font-semibold text-slate-200 block mb-1">
              3. Isolated Docker Sandbox
            </span>
            Code is executed only inside an isolated container with no network access (<code className="text-brand-accent">--network none</code>) and 256MB RAM limits.
          </div>
        </div>
      </div>

      {/* Recent Problems & Execution History */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Recent Problems */}
        <div className="bg-graphite-900 p-5 rounded-xl border border-graphite-750 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center space-x-1.5">
              <History className="w-4 h-4 text-slate-400" />
              <span>Recent Problems ({history?.problems?.length || 0})</span>
            </h3>
          </div>

          <div className="space-y-2">
            {history?.problems && history.problems.length > 0 ? (
              history.problems.slice(0, 5).map((p) => (
                <div
                  key={p.id}
                  onClick={() => onSelectProblem(p as Problem)}
                  className="p-3 bg-graphite-850 hover:bg-graphite-800 rounded-lg border border-graphite-750 cursor-pointer transition-colors flex items-center justify-between"
                >
                  <div>
                    <span className="text-xs font-semibold text-slate-200 block">
                      {p.title}
                    </span>
                    <span className="text-[11px] text-slate-500 font-mono">
                      {new Date(p.created_at).toLocaleString()}
                    </span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-500" />
                </div>
              ))
            ) : (
              <div className="text-slate-500 text-xs italic p-4 text-center">
                No recent problems saved.
              </div>
            )}
          </div>
        </div>

        {/* Recent Execution Runs */}
        <div className="bg-graphite-900 p-5 rounded-xl border border-graphite-750 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center space-x-1.5">
              <Play className="w-4 h-4 text-slate-400" />
              <span>Recent Sandbox Runs ({history?.runs?.length || 0})</span>
            </h3>
          </div>

          <div className="space-y-2">
            {history?.runs && history.runs.length > 0 ? (
              history.runs.slice(0, 5).map((r) => (
                <div
                  key={r.id}
                  className="p-3 bg-graphite-850 rounded-lg border border-graphite-750 flex items-center justify-between text-xs"
                >
                  <div className="flex items-center space-x-2">
                    {r.status === 'success' ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <XCircle className="w-4 h-4 text-rose-400" />
                    )}
                    <div>
                      <span className="font-mono text-slate-200 uppercase font-medium">
                        Run #{r.id}: {r.status}
                      </span>
                      <span className="text-[11px] text-slate-500 block font-mono">
                        {new Date(r.created_at).toLocaleTimeString()} &bull; {r.duration_ms}ms
                      </span>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-slate-500 text-xs italic p-4 text-center">
                No test runs executed yet.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
