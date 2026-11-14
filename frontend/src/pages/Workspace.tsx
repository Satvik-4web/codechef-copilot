import React, { useState } from 'react';
import {
  AppMode,
  Problem,
  TestCase,
  ExecutionResponse,
  AssistantMessage,
} from '../types';
import { ProblemStatementPanel } from '../features/problems/ProblemStatementPanel';
import { MonacoCodeEditor } from '../features/editor/MonacoEditor';
import { AssistantPanel } from '../features/assistant/AssistantPanel';
import { TestRunnerPanel } from '../features/execution/TestRunnerPanel';
import { SubmissionGuidanceModal } from '../components/SubmissionGuidanceModal';
import { ShieldCheck, ExternalLink } from 'lucide-react';

interface WorkspaceProps {
  mode: AppMode;
  problem: Problem | null;
  code: string;
  onCodeChange: (code: string) => void;
  onSaveDraft: () => void;
  isSavingDraft: boolean;
  hasSavedDraft: boolean;
  onResetCode: () => void;
  onEditProblem: () => void;
  // Execution
  tests: TestCase[];
  onAddTest: () => void;
  onUpdateTest: (idx: number, updated: TestCase) => void;
  onDeleteTest: (idx: number) => void;
  onRunTests: () => void;
  isRunningTests: boolean;
  executionResult: ExecutionResponse | null;
  // Assistant
  assistantMessage: AssistantMessage | null;
  isAssistantLoading: boolean;
  onRequestExplain: () => void;
  onRequestHint: (level: number) => void;
  onRequestApproach: () => void;
  onRequestReview: () => void;
  onRequestDebug: () => void;
  onRequestPracticeSolution: (userConfirmed: boolean) => void;
  // Submission
  onOpenSubmissionPage: () => void;
  isOpeningSubmission: boolean;
}

export const Workspace: React.FC<WorkspaceProps> = ({
  mode,
  problem,
  code,
  onCodeChange,
  onSaveDraft,
  isSavingDraft,
  hasSavedDraft,
  onResetCode,
  onEditProblem,
  tests,
  onAddTest,
  onUpdateTest,
  onDeleteTest,
  onRunTests,
  isRunningTests,
  executionResult,
  assistantMessage,
  isAssistantLoading,
  onRequestExplain,
  onRequestHint,
  onRequestApproach,
  onRequestReview,
  onRequestDebug,
  onRequestPracticeSolution,
  onOpenSubmissionPage,
  isOpeningSubmission,
}) => {
  const [isSubmissionModalOpen, setIsSubmissionModalOpen] = useState(false);

  return (
    <div className="flex-1 flex flex-col h-[calc(100vh-4rem)] overflow-hidden">
      {/* Workspace Sub-Header */}
      <div className="h-10 border-b border-graphite-750 bg-graphite-900 px-4 flex items-center justify-between select-none">
        <div className="flex items-center space-x-3 text-xs">
          <span className="font-semibold text-slate-200">
            {problem ? problem.title : 'Workspace'}
          </span>
          {problem?.source_url && (
            <a
              href={problem.source_url}
              target="_blank"
              rel="noreferrer"
              className="text-brand-accent hover:underline flex items-center space-x-1 font-mono text-[11px]"
            >
              <span>CodeChef Link</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={() => setIsSubmissionModalOpen(true)}
            className="px-3 py-1 bg-brand-600 hover:bg-brand-500 text-white rounded text-xs font-semibold flex items-center space-x-1.5 transition-colors shadow-sm"
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Review & Submit Guidance</span>
          </button>
        </div>
      </div>

      {/* Main Multi-Pane Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Pane: Problem Statement (approx 28% width) */}
        <div className="w-[30%] min-w-[300px] max-w-[420px] h-full flex flex-col">
          <ProblemStatementPanel problem={problem} onEditProblem={onEditProblem} />
        </div>

        {/* Center Pane: Editor + Bottom Test Runner (approx 44% width) */}
        <div className="flex-1 h-full flex flex-col min-w-[380px] border-r border-graphite-750">
          {/* Top: Monaco Code Editor */}
          <div className="h-[62%] w-full">
            <MonacoCodeEditor
              code={code}
              onChange={onCodeChange}
              onSaveDraft={onSaveDraft}
              isSaving={isSavingDraft}
              hasSaved={hasSavedDraft}
              onResetCode={onResetCode}
              language="cpp17"
            />
          </div>

          {/* Bottom: Test Runner Panel */}
          <div className="h-[38%] w-full">
            <TestRunnerPanel
              tests={tests}
              onAddTest={onAddTest}
              onUpdateTest={onUpdateTest}
              onDeleteTest={onDeleteTest}
              onRunTests={onRunTests}
              isRunning={isRunningTests}
              executionResult={executionResult}
            />
          </div>
        </div>

        {/* Right Pane: Learning Assistant (approx 28% width) */}
        <div className="w-[28%] min-w-[320px] max-w-[420px] h-full flex flex-col">
          <AssistantPanel
            mode={mode}
            problem={problem}
            currentCode={code}
            compilerError={executionResult?.compile_stderr || ''}
            runtimeError={executionResult?.status === 'runtime_error' ? 'Runtime error detected in execution results.' : ''}
            onApplyCode={(c) => onCodeChange(c)}
            onRequestExplain={onRequestExplain}
            onRequestHint={onRequestHint}
            onRequestApproach={onRequestApproach}
            onRequestReview={onRequestReview}
            onRequestDebug={onRequestDebug}
            onRequestPracticeSolution={onRequestPracticeSolution}
            assistantMessage={assistantMessage}
            isLoading={isAssistantLoading}
          />
        </div>
      </div>

      {/* Submission Guidance Modal */}
      <SubmissionGuidanceModal
        isOpen={isSubmissionModalOpen}
        onClose={() => setIsSubmissionModalOpen(false)}
        problem={problem}
        onOpenManualSubmissionPage={() => {
          onOpenSubmissionPage();
          setIsSubmissionModalOpen(false);
        }}
        isOpeningManual={isOpeningSubmission}
      />
    </div>
  );
};
