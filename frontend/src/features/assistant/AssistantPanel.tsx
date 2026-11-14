import React, { useState } from 'react';
import {
  AppMode,
  AssistantMessage,
  Problem,
} from '../../types';
import {
  BookOpen,
  Lightbulb,
  Compass,
  Code2,
  Bug,
  Sparkles,
  AlertTriangle,
  Copy,
  Check,
  CornerDownLeft,
  GraduationCap,
  Info,
} from 'lucide-react';

interface AssistantPanelProps {
  mode: AppMode;
  problem: Problem | null;
  currentCode: string;
  compilerError: string;
  runtimeError: string;
  onApplyCode: (code: string) => void;
  onRequestExplain: () => void;
  onRequestHint: (level: number) => void;
  onRequestApproach: () => void;
  onRequestReview: () => void;
  onRequestDebug: () => void;
  onRequestPracticeSolution: (userConfirmed: boolean) => void;
  assistantMessage: AssistantMessage | null;
  isLoading: boolean;
}

export const AssistantPanel: React.FC<AssistantPanelProps> = ({
  mode,
  problem,
  currentCode,
  compilerError,
  runtimeError,
  onApplyCode,
  onRequestExplain,
  onRequestHint,
  onRequestApproach,
  onRequestReview,
  onRequestDebug,
  onRequestPracticeSolution,
  assistantMessage,
  isLoading,
}) => {
  const [activeTab, setActiveTab] = useState<'explain' | 'hints' | 'approach' | 'review' | 'debug' | 'practice'>('explain');
  const [hintLevel, setHintLevel] = useState<number>(1);
  const [practiceConfirmed, setPracticeConfirmed] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="h-full flex flex-col bg-graphite-900 border-l border-graphite-750 overflow-hidden">
      {/* Panel Header & Mode Banner */}
      <div className="border-b border-graphite-750 bg-graphite-850 p-3 select-none">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <GraduationCap className="w-4 h-4 text-brand-accent" />
            <span className="text-xs font-bold text-slate-200">Learning Assistant</span>
          </div>

          <span
            className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${
              mode === 'learning'
                ? 'bg-brand-950/60 border-brand-800 text-brand-accent'
                : 'bg-amber-950/60 border-amber-800 text-amber-400'
            }`}
          >
            {mode === 'learning' ? 'Learning Mode (Protected)' : 'Practice Mode (AI Gated)'}
          </span>
        </div>

        {/* Mode Explanatory Notice */}
        <p className="text-[11px] text-slate-400 mt-1 leading-tight">
          {mode === 'learning'
            ? 'Full solutions are disabled to protect academic integrity. Receive conceptual explanations, graduated hints, and code reviews.'
            : 'Personal practice mode. Verify that applicable platform/course rules permit AI assistance before generating solutions.'}
        </p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-graphite-750 bg-graphite-950 overflow-x-auto text-xs font-medium select-none">
        <button
          onClick={() => { setActiveTab('explain'); onRequestExplain(); }}
          className={`flex items-center space-x-1 px-3 py-2 border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'explain'
              ? 'border-brand-500 text-slate-100 bg-graphite-900'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <BookOpen className="w-3.5 h-3.5" />
          <span>Explain</span>
        </button>

        <button
          onClick={() => { setActiveTab('hints'); onRequestHint(hintLevel); }}
          className={`flex items-center space-x-1 px-3 py-2 border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'hints'
              ? 'border-brand-500 text-slate-100 bg-graphite-900'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Lightbulb className="w-3.5 h-3.5" />
          <span>Hints</span>
        </button>

        <button
          onClick={() => { setActiveTab('approach'); onRequestApproach(); }}
          className={`flex items-center space-x-1 px-3 py-2 border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'approach'
              ? 'border-brand-500 text-slate-100 bg-graphite-900'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Compass className="w-3.5 h-3.5" />
          <span>Approach</span>
        </button>

        <button
          onClick={() => { setActiveTab('review'); onRequestReview(); }}
          className={`flex items-center space-x-1 px-3 py-2 border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'review'
              ? 'border-brand-500 text-slate-100 bg-graphite-900'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Code2 className="w-3.5 h-3.5" />
          <span>Review</span>
        </button>

        <button
          onClick={() => { setActiveTab('debug'); onRequestDebug(); }}
          className={`flex items-center space-x-1 px-3 py-2 border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'debug'
              ? 'border-brand-500 text-slate-100 bg-graphite-900'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Bug className="w-3.5 h-3.5" />
          <span>Debug</span>
        </button>

        <button
          onClick={() => setActiveTab('practice')}
          className={`flex items-center space-x-1 px-3 py-2 border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'practice'
              ? 'border-amber-500 text-amber-200 bg-graphite-900'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>Solution</span>
        </button>
      </div>

      {/* Tab Controls Bar */}
      <div className="p-2.5 bg-graphite-850/60 border-b border-graphite-750 flex items-center justify-between text-xs">
        {activeTab === 'hints' && (
          <div className="flex items-center space-x-2">
            <span className="text-slate-400 text-[11px]">Graduated Hint Level:</span>
            <div className="flex rounded bg-graphite-900 border border-graphite-750 p-0.5">
              {[1, 2, 3].map((lvl) => (
                <button
                  key={lvl}
                  onClick={() => {
                    setHintLevel(lvl);
                    onRequestHint(lvl);
                  }}
                  className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                    hintLevel === lvl
                      ? 'bg-brand-600 text-white'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Level {lvl}
                </button>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'review' && (
          <button
            onClick={onRequestReview}
            disabled={isLoading || !currentCode.trim()}
            className="px-2.5 py-1 bg-brand-600 hover:bg-brand-500 text-white rounded text-xs font-medium flex items-center space-x-1 transition-colors disabled:opacity-50"
          >
            <Code2 className="w-3 h-3" />
            <span>Review Current Code</span>
          </button>
        )}

        {activeTab === 'debug' && (
          <button
            onClick={onRequestDebug}
            disabled={isLoading}
            className="px-2.5 py-1 bg-brand-600 hover:bg-brand-500 text-white rounded text-xs font-medium flex items-center space-x-1 transition-colors disabled:opacity-50"
          >
            <Bug className="w-3 h-3" />
            <span>Diagnose Compile/Runtime Error</span>
          </button>
        )}

        {activeTab === 'practice' && mode === 'learning' && (
          <div className="flex items-center space-x-1.5 text-amber-400 text-[11px]">
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Solution generation is restricted in Learning Mode.</span>
          </div>
        )}

        {activeTab === 'practice' && mode === 'practice' && (
          <div className="flex items-center space-x-3 w-full justify-between">
            <label className="flex items-center space-x-2 text-[11px] text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={practiceConfirmed}
                onChange={(e) => setPracticeConfirmed(e.target.checked)}
                className="rounded border-graphite-700 text-brand-600 focus:ring-0 bg-graphite-900"
              />
              <span>I confirm AI-assisted code is permitted for this task</span>
            </label>

            <button
              onClick={() => onRequestPracticeSolution(practiceConfirmed)}
              disabled={isLoading || !practiceConfirmed}
              className="px-3 py-1 bg-amber-600 hover:bg-amber-500 text-white rounded text-xs font-medium flex items-center space-x-1 transition-colors disabled:opacity-40"
            >
              <Sparkles className="w-3 h-3" />
              <span>Generate Practice Code</span>
            </button>
          </div>
        )}
      </div>

      {/* Assistant Content Area (Scrollable) */}
      <div className="flex-1 overflow-y-auto p-4 text-xs leading-relaxed text-slate-300">
        {isLoading ? (
          <div className="h-full flex flex-col items-center justify-center space-y-2 text-slate-400">
            <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-[11px]">Consulting pedagogical engine...</p>
          </div>
        ) : activeTab === 'practice' && mode === 'learning' ? (
          <div className="p-4 bg-amber-950/20 border border-amber-900/40 rounded-lg text-slate-300 space-y-3">
            <div className="flex items-center space-x-2 text-amber-400 font-semibold">
              <AlertTriangle className="w-4 h-4" />
              <span>Learning Mode Safeguard</span>
            </div>
            <p className="text-xs">
              To guarantee educational integrity and protect students from accidental plagiarism on coursework, contests, and graded tests, CodeChef Copilot refuses complete ready-to-submit answers in Learning Mode.
            </p>
            <p className="text-xs text-slate-400">
              Try using the <strong>Explain</strong>, <strong>Hints (Levels 1-3)</strong>, or <strong>Approach</strong> tabs. If this is strictly personal practice where AI code generation is permitted by your contest/course rules, switch the mode selector in the top bar to <strong>Practice</strong>.
            </p>
          </div>
        ) : assistantMessage ? (
          <div className="space-y-4">
            {assistantMessage.disclaimer && (
              <div className="p-2.5 bg-graphite-850 border border-graphite-750 rounded text-[11px] text-slate-400 flex items-start space-x-2">
                <Info className="w-3.5 h-3.5 text-brand-accent mt-0.5 flex-shrink-0" />
                <span>{assistantMessage.disclaimer}</span>
              </div>
            )}

            {assistantMessage.is_ai_assisted && (
              <div className="p-2 bg-amber-950/30 border border-amber-800/40 rounded text-[11px] text-amber-300 flex items-center justify-between">
                <span>AI-Assisted Code Generated for Practice</span>
                <button
                  onClick={() => handleCopy(assistantMessage.generated_code || assistantMessage.message)}
                  className="flex items-center space-x-1 text-slate-400 hover:text-slate-200"
                >
                  {copied ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-400" />
                      <span className="text-emerald-400">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      <span>Copy</span>
                    </>
                  )}
                </button>
              </div>
            )}

            <div className="prose prose-invert prose-xs max-w-none bg-graphite-850/80 p-3.5 rounded-lg border border-graphite-750 whitespace-pre-wrap font-sans text-slate-200">
              {assistantMessage.generated_code || assistantMessage.message}
            </div>

            {assistantMessage.generated_code && (
              <div className="flex justify-end space-x-2">
                <button
                  onClick={() => onApplyCode(assistantMessage.generated_code || '')}
                  className="px-3 py-1.5 bg-brand-600 hover:bg-brand-500 text-white rounded text-xs font-medium flex items-center space-x-1.5 transition-colors"
                >
                  <CornerDownLeft className="w-3.5 h-3.5" />
                  <span>Insert into Monaco Editor</span>
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-500">
            <Lightbulb className="w-10 h-10 text-slate-600 mb-2" />
            <p className="text-xs text-slate-400 font-medium">Select an action above</p>
            <p className="text-[11px] text-slate-500 max-w-xs mt-1">
              CodeChef Copilot is ready to explain the problem, provide hints, evaluate time complexity, review your code, or debug compiler output.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
