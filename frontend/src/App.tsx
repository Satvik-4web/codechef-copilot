import React, { useState, useEffect } from 'react';
import type {
  AppMode,
  BrowserStatus,
  Problem,
  Draft,
  TestCase,
  ExecutionResponse,
  AssistantMessage,
  HistoryData,
  UserSettings,
  AssignmentBatch,
  AssignmentTask,
  AgentEvent,
  TaskAssistanceStatus,
  TaskMode,
} from './types';
import { api } from './services/api';
import { Header } from './components/Header';
import { Dashboard } from './pages/Dashboard';
import { DiscoveryPage } from './pages/Discovery';
import { AgentQueuePage } from './pages/AgentQueue';
import { Workspace } from './pages/Workspace';
import { HistoryPage } from './pages/History';
import { SettingsPage } from './pages/Settings';
import { ManualProblemModal } from './components/ManualProblemModal';
import { SubmissionGuidanceModal } from './components/SubmissionGuidanceModal';

const DEFAULT_CPP_BOILERPLATE = `#include <iostream>
#include <vector>
#include <string>
#include <algorithm>

using namespace std;

void solve() {
    // Write your solution here
    long long n;
    if (!(cin >> n)) return;
    cout << n << "\\n";
}

int main() {
    // Fast I/O for competitive programming
    ios_base::sync_with_stdio(false);
    cin.tie(NULL);

    int t = 1;
    if (cin >> t) {
        while (t--) {
            solve();
        }
    }
    return 0;
}
`;

export const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<'dashboard' | 'discovery' | 'queue' | 'workspace' | 'history' | 'settings'>('dashboard');
  const [mode, setMode] = useState<AppMode>('learning');
  const [browserStatus, setBrowserStatus] = useState<BrowserStatus | null>(null);
  const [activeProblem, setActiveProblem] = useState<Problem | null>(null);
  const [code, setCode] = useState<string>(DEFAULT_CPP_BOILERPLATE);
  const [activeDraft, setActiveDraft] = useState<Draft | null>(null);
  const [tests, setTests] = useState<TestCase[]>([
    { name: 'Sample 1', stdin: '1\n5', expected_stdout: '5' },
  ]);

  // Agent State
  const [batches, setBatches] = useState<AssignmentBatch[]>([]);
  const [currentBatch, setCurrentBatch] = useState<AssignmentBatch | null>(null);
  const [agentTasks, setAgentTasks] = useState<AssignmentTask[]>([]);
  const [agentEvents, setAgentEvents] = useState<AgentEvent[]>([]);
  const [selectedTaskForSubmission, setSelectedTaskForSubmission] = useState<AssignmentTask | null>(null);
  const [isSubmissionModalOpen, setIsSubmissionModalOpen] = useState(false);

  // Execution & Diagnostics
  const [isRunningTests, setIsRunningTests] = useState<boolean>(false);
  const [executionResult, setExecutionResult] = useState<ExecutionResponse | null>(null);

  // Assistant State
  const [assistantMessage, setAssistantMessage] = useState<AssistantMessage | null>(null);
  const [isAssistantLoading, setIsAssistantLoading] = useState<boolean>(false);

  // Metadata & History
  const [history, setHistory] = useState<HistoryData | null>(null);
  const [settings, setSettings] = useState<UserSettings | null>(null);

  // Flags & Modals
  const [isCapturing, setIsCapturing] = useState<boolean>(false);
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [isQueueing, setIsQueueing] = useState<boolean>(false);
  const [isProcessingTask, setIsProcessingTask] = useState<boolean>(false);
  const [isSavingDraft, setIsSavingDraft] = useState<boolean>(false);
  const [hasSavedDraft, setHasSavedDraft] = useState<boolean>(false);
  const [isManualModalOpen, setIsManualModalOpen] = useState<boolean>(false);
  const [isOpeningSubmission, setIsOpeningSubmission] = useState<boolean>(false);

  useEffect(() => {
    fetchInitialData();
    const interval = setInterval(() => {
      fetchBrowserStatus();
      refreshAgentState();
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  const fetchInitialData = async () => {
    try {
      await fetchBrowserStatus();
      const s = await api.getSettings();
      setSettings(s);
      if (s.active_mode) setMode(s.active_mode);
      const h = await api.getHistory();
      setHistory(h);

      // Load batches & tasks
      const bList = await api.getBatches();
      setBatches(bList);
      if (bList.length > 0) {
        setCurrentBatch(bList[0]);
        setAgentTasks(bList.flatMap((b) => b.tasks));
      }

      // If problems exist, load the latest one
      const problems = await api.getProblems();
      if (problems.length > 0) {
        loadProblem(problems[0]);
      }
    } catch (err) {
      console.warn('Initial data load error:', err);
    }
  };

  const fetchBrowserStatus = async () => {
    try {
      const status = await api.getBrowserStatus();
      setBrowserStatus(status);
    } catch {
      setBrowserStatus(null);
    }
  };

  const refreshAgentState = async () => {
    try {
      const bList = await api.getBatches();
      setBatches(bList);
      const allTasks = bList.flatMap((b) => b.tasks);
      setAgentTasks(allTasks);

      // If tasks exist, fetch latest events for the first active task
      if (allTasks.length > 0) {
        const evts = await api.getTaskEvents(allTasks[0].id);
        setAgentEvents(evts);
      }
    } catch {
      // Ignore background refresh errors
    }
  };

  const loadProblem = async (p: Problem) => {
    setActiveProblem(p);
    if (p.examples && p.examples.length > 0) {
      setTests(p.examples);
    }

    try {
      const draft = await api.getDraftForProblem(p.id);
      if (draft && draft.source_code) {
        setActiveDraft(draft);
        setCode(draft.source_code);
      } else {
        setActiveDraft(null);
        setCode(DEFAULT_CPP_BOILERPLATE);
      }
    } catch {
      setActiveDraft(null);
      setCode(DEFAULT_CPP_BOILERPLATE);
    }

    setExecutionResult(null);
    setAssistantMessage(null);
  };

  // Browser Actions
  const handleLaunchBrowser = async () => {
    try {
      const status = await api.launchBrowser(false);
      setBrowserStatus(status);
    } catch (err: any) {
      alert(`Could not launch browser: ${err.message}`);
    }
  };

  const handleCloseBrowser = async () => {
    try {
      const status = await api.closeBrowser();
      setBrowserStatus(status);
    } catch (err: any) {
      alert(`Could not close browser: ${err.message}`);
    }
  };

  const handleCapturePage = async () => {
    setIsCapturing(true);
    try {
      const captureData = await api.captureCurrentPage();
      const parsedProblem = await api.parseProblem({
        raw_html: captureData.html,
        url: captureData.url,
      });
      loadProblem(parsedProblem);
      setCurrentView('workspace');
      const h = await api.getHistory();
      setHistory(h);
    } catch (err: any) {
      alert(`Problem Capture Failed: ${err.message}`);
    } finally {
      setIsCapturing(false);
    }
  };

  // Discovery Actions
  const handleScanDiscoveryPage = async () => {
    setIsScanning(true);
    try {
      const batch = await api.discoverTasks();
      setCurrentBatch(batch);
      setBatches((prev) => [batch, ...prev.filter((b) => b.id !== batch.id)]);
      setAgentTasks((prev) => [...batch.tasks, ...prev]);
      setCurrentView('discovery');
    } catch (err: any) {
      alert(`Task Discovery Failed: ${err.message}`);
    } finally {
      setIsScanning(false);
    }
  };

  const handleQueueSelectedTasks = async (batchId: number, taskIds: number[]) => {
    setIsQueueing(true);
    try {
      const updated = await api.selectTasks(batchId, taskIds);
      await refreshAgentState();
      setCurrentView('queue');
    } catch (err: any) {
      alert(`Queue selection failed: ${err.message}`);
    } finally {
      setIsQueueing(false);
    }
  };

  // Agent Task Actions
  const handleStartTask = async (taskId: number) => {
    setIsProcessingTask(true);
    try {
      const task = await api.startTask(taskId);
      await refreshAgentState();
      const evts = await api.getTaskEvents(taskId);
      setAgentEvents(evts);
      if (task.problem_id) {
        const p = await api.getProblem(task.problem_id);
        loadProblem(p);
      }
    } catch (err: any) {
      alert(`Task processing halted: ${err.message}`);
    } finally {
      setIsProcessingTask(false);
    }
  };

  const handlePauseTask = async (taskId: number) => {
    try {
      await api.pauseTask(taskId);
      await refreshAgentState();
    } catch (err: any) {
      alert(`Pause failed: ${err.message}`);
    }
  };

  const handleResumeTask = async (taskId: number) => {
    try {
      await api.resumeTask(taskId);
      await refreshAgentState();
    } catch (err: any) {
      alert(`Resume failed: ${err.message}`);
    }
  };

  const handleCancelTask = async (taskId: number) => {
    try {
      await api.cancelTask(taskId);
      await refreshAgentState();
    } catch (err: any) {
      alert(`Cancel failed: ${err.message}`);
    }
  };

  const handleUpdatePermission = async (
    taskId: number,
    status: TaskAssistanceStatus,
    autoSub: boolean,
    source: string,
    tMode: TaskMode
  ) => {
    try {
      await api.updateTaskPermission(taskId, {
        assistance_status: status,
        automated_submission_allowed: autoSub,
        permission_source: source,
        task_mode: tMode,
      });
      await refreshAgentState();
    } catch (err: any) {
      alert(`Permission update failed: ${err.message}`);
    }
  };

  const handleEmergencyStop = async () => {
    try {
      await api.emergencyStop();
      await refreshAgentState();
      alert('Emergency stop engaged. All active tasks have been paused.');
    } catch (err: any) {
      alert(`Emergency stop error: ${err.message}`);
    }
  };

  const handleClearQueue = async () => {
    try {
      await api.clearQueue();
      await refreshAgentState();
    } catch (err: any) {
      alert(`Clear queue error: ${err.message}`);
    }
  };

  const handleOpenWorkspaceForTask = async (task: AssignmentTask) => {
    setSelectedTaskForSubmission(task);
    if (task.problem_id) {
      try {
        const p = await api.getProblem(task.problem_id);
        loadProblem(p);
      } catch {
        // Fallback
      }
    }
    setCurrentView('workspace');
  };

  const handleOpenSubmissionPage = async () => {
    if (!activeProblem) return;
    setIsOpeningSubmission(true);
    try {
      const targetUrl = activeProblem.source_url
        ? activeProblem.source_url.replace('/problems/', '/submit/')
        : 'https://www.codechef.com';
      await api.navigateBrowser(targetUrl);
    } catch (err: any) {
      alert(`Could not open submission page in browser: ${err.message}`);
    } finally {
      setIsOpeningSubmission(false);
    }
  };

  // Manual Problem Creation / Editing
  const handleSaveManualProblem = async (data: {
    title: string;
    source_url: string;
    statement: string;
    input_format: string;
    output_format: string;
    constraints: string;
    examples: TestCase[];
  }) => {
    try {
      let saved: Problem;
      if (activeProblem && activeProblem.id) {
        saved = await api.updateProblem(activeProblem.id, data);
      } else {
        saved = await api.parseProblem({
          manual_title: data.title,
          manual_statement: data.statement,
          url: data.source_url,
        });
        saved = await api.updateProblem(saved.id, data);
      }
      loadProblem(saved);
      setCurrentView('workspace');
      const h = await api.getHistory();
      setHistory(h);
    } catch (err: any) {
      alert(`Failed to save problem: ${err.message}`);
    }
  };

  // Draft Saving
  const handleSaveDraft = async () => {
    setIsSavingDraft(true);
    try {
      if (activeDraft) {
        const updated = await api.updateDraft(activeDraft.id, {
          source_code: code,
          mode,
        });
        setActiveDraft(updated);
      } else {
        const created = await api.createDraft({
          problem_id: activeProblem?.id,
          language: 'cpp17',
          source_code: code,
          mode,
        });
        setActiveDraft(created);
      }
      setHasSavedDraft(true);
      setTimeout(() => setHasSavedDraft(false), 2000);
      const h = await api.getHistory();
      setHistory(h);
    } catch (err: any) {
      alert(`Failed to save draft: ${err.message}`);
    } finally {
      setIsSavingDraft(false);
    }
  };

  // Test Runner Actions
  const handleAddTest = () => {
    setTests([
      ...tests,
      { name: `Custom ${tests.length + 1}`, stdin: '', expected_stdout: '' },
    ]);
  };

  const handleUpdateTest = (idx: number, updated: TestCase) => {
    const list = [...tests];
    list[idx] = updated;
    setTests(list);
  };

  const handleDeleteTest = (idx: number) => {
    if (tests.length > 1) {
      setTests(tests.filter((_, i) => i !== idx));
    }
  };

  const handleRunTests = async () => {
    setIsRunningTests(true);
    try {
      const res = await api.runCode({
        language: 'cpp17',
        source_code: code,
        tests,
        draft_id: activeDraft?.id,
      });
      setExecutionResult(res);
      const h = await api.getHistory();
      setHistory(h);
    } catch (err: any) {
      alert(`Execution Error: ${err.message}`);
    } finally {
      setIsRunningTests(false);
    }
  };

  // Assistant Actions
  const handleRequestExplain = async () => {
    setIsAssistantLoading(true);
    try {
      const res = await api.explainProblem({
        problem_id: activeProblem?.id,
        statement: activeProblem?.statement,
      });
      setAssistantMessage(res);
    } catch (err: any) {
      alert(`Assistant error: ${err.message}`);
    } finally {
      setIsAssistantLoading(false);
    }
  };

  const handleRequestHint = async (level: number) => {
    setIsAssistantLoading(true);
    try {
      const res = await api.getHint({
        problem_id: activeProblem?.id,
        current_code: code,
        hint_level: level,
      });
      setAssistantMessage(res);
    } catch (err: any) {
      alert(`Assistant error: ${err.message}`);
    } finally {
      setIsAssistantLoading(false);
    }
  };

  const handleRequestApproach = async () => {
    setIsAssistantLoading(true);
    try {
      const res = await api.discussApproach({
        problem_id: activeProblem?.id,
      });
      setAssistantMessage(res);
    } catch (err: any) {
      alert(`Assistant error: ${err.message}`);
    } finally {
      setIsAssistantLoading(false);
    }
  };

  const handleRequestReview = async () => {
    setIsAssistantLoading(true);
    try {
      const res = await api.reviewCode({
        problem_id: activeProblem?.id,
        source_code: code,
        language: 'cpp17',
      });
      setAssistantMessage(res);
    } catch (err: any) {
      alert(`Assistant error: ${err.message}`);
    } finally {
      setIsAssistantLoading(false);
    }
  };

  const handleRequestDebug = async () => {
    setIsAssistantLoading(true);
    try {
      const res = await api.debugError({
        problem_id: activeProblem?.id,
        source_code: code,
        compiler_error: executionResult?.compile_stderr,
        runtime_error: executionResult?.status === 'runtime_error' ? 'Runtime error encountered' : undefined,
      });
      setAssistantMessage(res);
    } catch (err: any) {
      alert(`Assistant error: ${err.message}`);
    } finally {
      setIsAssistantLoading(false);
    }
  };

  const handleRequestPracticeSolution = async (userConfirmed: boolean) => {
    setIsAssistantLoading(true);
    try {
      const res = await api.generatePracticeSolution({
        problem_id: activeProblem?.id,
        user_confirmed_allowed: userConfirmed,
      });
      setAssistantMessage(res);
    } catch (err: any) {
      alert(`Academic Integrity Guard: ${err.message}`);
    } finally {
      setIsAssistantLoading(false);
    }
  };

  const queuedCount = agentTasks.filter((t) => t.state === 'QUEUED').length;

  return (
    <div className="min-h-screen bg-graphite-950 text-slate-100 flex flex-col antialiased">
      <Header
        mode={mode}
        onModeChange={(m) => {
          setMode(m);
          api.updateSettings({ active_mode: m }).catch(() => {});
        }}
        browserStatus={browserStatus}
        onLaunchBrowser={handleLaunchBrowser}
        onCloseBrowser={handleCloseBrowser}
        onCapturePage={handleCapturePage}
        isCapturing={isCapturing}
        activeProblem={activeProblem}
        onOpenManualModal={() => setIsManualModalOpen(true)}
        currentView={currentView}
        setCurrentView={setCurrentView}
        onEmergencyStop={handleEmergencyStop}
        queuedTasksCount={queuedCount}
      />

      <main className="flex-1 flex flex-col overflow-hidden">
        {currentView === 'dashboard' && (
          <Dashboard
            mode={mode}
            onModeChange={setMode}
            browserStatus={browserStatus}
            onLaunchBrowser={handleLaunchBrowser}
            onCloseBrowser={handleCloseBrowser}
            onCapturePage={handleCapturePage}
            isCapturing={isCapturing}
            activeProblem={activeProblem}
            onSelectProblem={(p) => {
              loadProblem(p);
              setCurrentView('workspace');
            }}
            history={history}
            settings={settings}
            onOpenWorkspace={() => setCurrentView('workspace')}
            onOpenManualModal={() => setIsManualModalOpen(true)}
          />
        )}

        {currentView === 'discovery' && (
          <DiscoveryPage
            currentBatch={currentBatch}
            onScanPage={handleScanDiscoveryPage}
            isScanning={isScanning}
            onQueueSelected={handleQueueSelectedTasks}
            isQueueing={isQueueing}
            onNavigateToQueue={() => setCurrentView('queue')}
          />
        )}

        {currentView === 'queue' && (
          <AgentQueuePage
            tasks={agentTasks}
            events={agentEvents}
            onStartTask={handleStartTask}
            onPauseTask={handlePauseTask}
            onResumeTask={handleResumeTask}
            onCancelTask={handleCancelTask}
            onUpdatePermission={handleUpdatePermission}
            onOpenWorkspaceForTask={handleOpenWorkspaceForTask}
            onOpenSubmissionModal={(t) => {
              setSelectedTaskForSubmission(t);
              setIsSubmissionModalOpen(true);
            }}
            onEmergencyStop={handleEmergencyStop}
            onClearQueue={handleClearQueue}
            isProcessing={isProcessingTask}
          />
        )}

        {currentView === 'workspace' && (
          <Workspace
            mode={mode}
            problem={activeProblem}
            code={code}
            onCodeChange={setCode}
            onSaveDraft={handleSaveDraft}
            isSavingDraft={isSavingDraft}
            hasSavedDraft={hasSavedDraft}
            onResetCode={() => setCode(DEFAULT_CPP_BOILERPLATE)}
            onEditProblem={() => setIsManualModalOpen(true)}
            tests={tests}
            onAddTest={handleAddTest}
            onUpdateTest={handleUpdateTest}
            onDeleteTest={handleDeleteTest}
            onRunTests={handleRunTests}
            isRunningTests={isRunningTests}
            executionResult={executionResult}
            assistantMessage={assistantMessage}
            isAssistantLoading={isAssistantLoading}
            onRequestExplain={handleRequestExplain}
            onRequestHint={handleRequestHint}
            onRequestApproach={handleRequestApproach}
            onRequestReview={handleRequestReview}
            onRequestDebug={handleRequestDebug}
            onRequestPracticeSolution={handleRequestPracticeSolution}
            onOpenSubmissionPage={handleOpenSubmissionPage}
            isOpeningSubmission={isOpeningSubmission}
          />
        )}

        {currentView === 'history' && (
          <HistoryPage
            history={history}
            onSelectProblem={(p) => {
              loadProblem(p);
              setCurrentView('workspace');
            }}
            onRefresh={async () => {
              const h = await api.getHistory();
              setHistory(h);
            }}
          />
        )}

        {currentView === 'settings' && (
          <SettingsPage
            settings={settings}
            onSaveSettings={async (data) => {
              const updated = await api.updateSettings(data);
              setSettings(updated);
              if (data.active_mode) setMode(data.active_mode);
            }}
            isSaving={false}
          />
        )}
      </main>

      <ManualProblemModal
        isOpen={isManualModalOpen}
        onClose={() => setIsManualModalOpen(false)}
        problem={activeProblem}
        onSave={handleSaveManualProblem}
      />

      <SubmissionGuidanceModal
        isOpen={isSubmissionModalOpen}
        onClose={() => setIsSubmissionModalOpen(false)}
        problem={activeProblem}
        task={selectedTaskForSubmission}
        onOpenManualSubmissionPage={() => {
          handleOpenSubmissionPage();
          setIsSubmissionModalOpen(false);
        }}
        isOpeningManual={isOpeningSubmission}
        onSubmissionSuccess={() => {
          refreshAgentState();
        }}
      />
    </div>
  );
};

export default App;
