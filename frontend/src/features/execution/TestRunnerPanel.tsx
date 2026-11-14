import React, { useState } from 'react';
import { TestCase, ExecutionResponse } from '../../types';
import {
  Play,
  Plus,
  Trash2,
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
  ServerOff,
  Terminal,
  ShieldAlert,
} from 'lucide-react';

interface TestRunnerPanelProps {
  tests: TestCase[];
  onAddTest: () => void;
  onUpdateTest: (idx: number, updated: TestCase) => void;
  onDeleteTest: (idx: number) => void;
  onRunTests: () => void;
  isRunning: boolean;
  executionResult: ExecutionResponse | null;
}

export const TestRunnerPanel: React.FC<TestRunnerPanelProps> = ({
  tests,
  onAddTest,
  onUpdateTest,
  onDeleteTest,
  onRunTests,
  isRunning,
  executionResult,
}) => {
  const [activeTestTab, setActiveTestTab] = useState<number>(0);
  const [showConsole, setShowConsole] = useState<boolean>(false);

  const getStatusBadge = () => {
    if (!executionResult) return null;

    if (executionResult.status === 'docker_unavailable') {
      return (
        <span className="flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-amber-950/80 border border-amber-800 text-amber-300">
          <ServerOff className="w-3.5 h-3.5" />
          <span>Docker Sandbox Offline</span>
        </span>
      );
    }

    if (executionResult.status === 'compile_error') {
      return (
        <span className="flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-rose-950/80 border border-rose-800 text-rose-300">
          <XCircle className="w-3.5 h-3.5" />
          <span>Compilation Error</span>
        </span>
      );
    }

    if (executionResult.status === 'runtime_error') {
      return (
        <span className="flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-rose-950/80 border border-rose-800 text-rose-300">
          <AlertCircle className="w-3.5 h-3.5" />
          <span>Runtime Error</span>
        </span>
      );
    }

    if (executionResult.status === 'timeout') {
      return (
        <span className="flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-amber-950/80 border border-amber-800 text-amber-300">
          <Clock className="w-3.5 h-3.5" />
          <span>Time Limit Exceeded</span>
        </span>
      );
    }

    if (executionResult.status === 'output_mismatch') {
      return (
        <span className="flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-amber-950/80 border border-amber-800 text-amber-300">
          <XCircle className="w-3.5 h-3.5" />
          <span>Output Mismatch</span>
        </span>
      );
    }

    if (executionResult.status === 'success') {
      return (
        <span className="flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-emerald-950/80 border border-emerald-800 text-emerald-300">
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span>All Local Tests Passed ({executionResult.duration_ms}ms)</span>
        </span>
      );
    }

    return null;
  };

  const validTab = Math.min(activeTestTab, Math.max(0, tests.length - 1));
  const currentResult = executionResult?.results?.[validTab];
  const activeTest = tests[validTab];

  return (
    <div className="h-full flex flex-col bg-graphite-900 border-t border-graphite-750 select-none">
      {/* Test Runner Toolbar */}
      <div className="h-10 border-b border-graphite-750 bg-graphite-850 px-3 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-1 overflow-x-auto">
            {tests.map((t, idx) => {
              const res = executionResult?.results?.[idx];
              return (
                <button
                  key={idx}
                  onClick={() => setActiveTestTab(idx)}
                  className={`flex items-center space-x-1.5 px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                    activeTestTab === idx
                      ? 'bg-graphite-750 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-graphite-800'
                  }`}
                >
                  {res && (
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        res.passed ? 'bg-emerald-400' : 'bg-rose-400'
                      }`}
                    />
                  )}
                  <span>{t.name || `Test ${idx + 1}`}</span>
                </button>
              );
            })}

            <button
              onClick={onAddTest}
              className="p-1 hover:bg-graphite-800 text-slate-400 hover:text-slate-200 rounded transition-colors"
              title="Add custom test case"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>

          {getStatusBadge()}
        </div>

        <div className="flex items-center space-x-2">
          {executionResult && (
            <button
              onClick={() => setShowConsole(!showConsole)}
              className={`px-2 py-1 rounded text-xs flex items-center space-x-1 border transition-colors ${
                showConsole
                  ? 'bg-graphite-750 border-graphite-600 text-white'
                  : 'bg-graphite-800 border-graphite-700 text-slate-300 hover:bg-graphite-750'
              }`}
            >
              <Terminal className="w-3 h-3" />
              <span>Console Logs</span>
            </button>
          )}

          <button
            onClick={onRunTests}
            disabled={isRunning || tests.length === 0}
            className="px-3.5 py-1 bg-brand-600 hover:bg-brand-500 text-white rounded text-xs font-semibold flex items-center space-x-1.5 transition-colors disabled:opacity-50 shadow-sm"
          >
            <Play className={`w-3.5 h-3.5 fill-current ${isRunning ? 'animate-spin' : ''}`} />
            <span>{isRunning ? 'Running in Sandbox...' : 'Run Isolated Tests'}</span>
          </button>
        </div>
      </div>

      {/* Test Runner Body */}
      <div className="flex-1 overflow-y-auto p-3 text-xs">
        {/* Docker Unavailable Diagnostic Banner */}
        {executionResult?.status === 'docker_unavailable' && (
          <div className="mb-3 p-3 bg-amber-950/30 border border-amber-800/60 rounded-lg text-slate-200 space-y-1.5">
            <div className="flex items-center space-x-2 text-amber-400 font-semibold">
              <ShieldAlert className="w-4 h-4" />
              <span>Docker Container Isolation Offline</span>
            </div>
            <p className="text-slate-300 text-xs">
              To guarantee that untrusted code does not harm your host machine, CodeChef Copilot runs C++17 inside an isolated, non-networked Docker container (<code className="text-amber-300">--network none</code>, 256MB RAM limit).
            </p>
            <p className="text-[11px] text-slate-400">
              <strong>Action required:</strong> Please start Docker Desktop on Windows. Once the Docker whale icon shows running, click &quot;Run Isolated Tests&quot; again.
            </p>
          </div>
        )}

        {/* Compiler Error Console */}
        {showConsole && executionResult && (
          <div className="mb-3 bg-graphite-950 p-3 rounded-lg border border-graphite-750 font-mono text-[11px]">
            <div className="text-slate-400 uppercase font-semibold text-[10px] mb-1">
              Compiler / Sandbox Diagnostics:
            </div>
            {executionResult.compile_stderr ? (
              <pre className="text-rose-400 whitespace-pre-wrap">{executionResult.compile_stderr}</pre>
            ) : executionResult.compile_stdout ? (
              <pre className="text-slate-300 whitespace-pre-wrap">{executionResult.compile_stdout}</pre>
            ) : (
              <div className="text-slate-500 italic">No compiler warnings or errors reported.</div>
            )}
          </div>
        )}

        {/* Active Test Case Inputs & Outputs */}
        {activeTest && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 h-full">
            {/* Input (stdin) */}
            <div className="flex flex-col space-y-1">
              <div className="flex items-center justify-between text-slate-400 font-mono text-[10px] uppercase">
                <span>Standard Input (stdin)</span>
                {tests.length > 1 && (
                  <button
                    onClick={() => {
                      onDeleteTest(validTab);
                      if (validTab > 0 && validTab === tests.length - 1) {
                        setActiveTestTab(validTab - 1);
                      }
                    }}
                    className="text-slate-500 hover:text-rose-400 p-0.5"
                    title="Delete this test case"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
              </div>
              <textarea
                value={activeTest.stdin}
                onChange={(e) =>
                  onUpdateTest(activeTestTab, { ...activeTest, stdin: e.target.value })
                }
                className="flex-1 w-full bg-graphite-850 border border-graphite-750 rounded p-2 font-mono text-[11px] text-slate-200 focus:outline-none focus:border-brand-500 resize-none min-h-[90px]"
                placeholder="Enter test input..."
              />
            </div>

            {/* Expected Output */}
            <div className="flex flex-col space-y-1">
              <span className="text-slate-400 font-mono text-[10px] uppercase">
                Expected Output
              </span>
              <textarea
                value={activeTest.expected_stdout}
                onChange={(e) =>
                  onUpdateTest(activeTestTab, { ...activeTest, expected_stdout: e.target.value })
                }
                className="flex-1 w-full bg-graphite-850 border border-graphite-750 rounded p-2 font-mono text-[11px] text-slate-200 focus:outline-none focus:border-brand-500 resize-none min-h-[90px]"
                placeholder="Enter expected stdout..."
              />
            </div>

            {/* Actual Output */}
            <div className="flex flex-col space-y-1">
              <div className="flex items-center justify-between text-slate-400 font-mono text-[10px] uppercase">
                <span>Actual Output</span>
                {currentResult && (
                  <span
                    className={`font-semibold ${
                      currentResult.passed ? 'text-emerald-400' : 'text-rose-400'
                    }`}
                  >
                    {currentResult.passed ? 'MATCH' : currentResult.status.toUpperCase()}
                  </span>
                )}
              </div>
              <div className="flex-1 w-full bg-graphite-950 border border-graphite-750 rounded p-2 font-mono text-[11px] text-slate-200 overflow-y-auto min-h-[90px] whitespace-pre-wrap">
                {currentResult ? (
                  currentResult.stderr ? (
                    <span className="text-rose-400">{currentResult.stderr}</span>
                  ) : (
                    currentResult.actual_stdout || '<no output>'
                  )
                ) : (
                  <span className="text-slate-500 italic">Run tests to see results.</span>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
