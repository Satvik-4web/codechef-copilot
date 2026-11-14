import React from 'react';
import { HistoryData, Problem } from '../types';
import { History, FileCode2, Play, MessageSquare, ExternalLink, ChevronRight, CheckCircle2, XCircle } from 'lucide-react';

interface HistoryProps {
  history: HistoryData | null;
  onSelectProblem: (p: any) => void;
  onRefresh: () => void;
}

export const HistoryPage: React.FC<HistoryProps> = ({
  history,
  onSelectProblem,
  onRefresh,
}) => {
  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6 max-w-5xl mx-auto w-full">
      <div className="flex items-center justify-between border-b border-graphite-750 pb-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center space-x-2">
            <History className="w-5 h-5 text-brand-accent" />
            <span>Local Activity & History</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Persisted locally in your SQLite database. Passwords, session cookies, and private tokens are never stored.
          </p>
        </div>
        <button
          onClick={onRefresh}
          className="px-3 py-1.5 bg-graphite-800 hover:bg-graphite-750 text-slate-200 rounded text-xs font-medium border border-graphite-700 transition-colors"
        >
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Saved Problems */}
        <div className="bg-graphite-900 p-5 rounded-xl border border-graphite-750 space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center space-x-2">
            <FileCode2 className="w-4 h-4 text-brand-accent" />
            <span>Captured & Saved Problems ({history?.problems?.length || 0})</span>
          </h3>

          <div className="space-y-2">
            {history?.problems && history.problems.length > 0 ? (
              history.problems.map((p) => (
                <div
                  key={p.id}
                  onClick={() => onSelectProblem(p)}
                  className="p-3 bg-graphite-850 hover:bg-graphite-800 rounded-lg border border-graphite-750 cursor-pointer transition-colors flex items-center justify-between"
                >
                  <div>
                    <span className="text-xs font-semibold text-slate-200 block">{p.title}</span>
                    <span className="text-[11px] text-slate-500 font-mono">
                      {new Date(p.created_at).toLocaleString()}
                    </span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-500" />
                </div>
              ))
            ) : (
              <div className="text-slate-500 text-xs italic p-4 text-center">No problems recorded.</div>
            )}
          </div>
        </div>

        {/* Execution Runs */}
        <div className="bg-graphite-900 p-5 rounded-xl border border-graphite-750 space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center space-x-2">
            <Play className="w-4 h-4 text-emerald-400" />
            <span>Sandbox Execution Runs ({history?.runs?.length || 0})</span>
          </h3>

          <div className="space-y-2">
            {history?.runs && history.runs.length > 0 ? (
              history.runs.map((r) => (
                <div
                  key={r.id}
                  className="p-3 bg-graphite-850 rounded-lg border border-graphite-750 flex items-center justify-between text-xs"
                >
                  <div className="flex items-center space-x-2.5">
                    {r.status === 'success' ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <XCircle className="w-4 h-4 text-rose-400" />
                    )}
                    <div>
                      <span className="font-mono text-slate-200 font-medium">
                        Run #{r.id} &bull; {r.status}
                      </span>
                      <span className="text-[11px] text-slate-500 block font-mono">
                        {new Date(r.created_at).toLocaleString()} &bull; {r.duration_ms}ms
                      </span>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-slate-500 text-xs italic p-4 text-center">No runs recorded.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
