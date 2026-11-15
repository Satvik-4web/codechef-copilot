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
  TaskPermission,
  AgentEvent,
  PrepareSubmissionResponse,
} from '../types';

const BASE_URL = 'http://127.0.0.1:8008/api';

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let errMsg = `Request failed (${res.status})`;
    try {
      const errData = await res.json();
      if (errData.detail) {
        errMsg = typeof errData.detail === 'string' ? errData.detail : JSON.stringify(errData.detail);
      }
    } catch {
      // Ignore JSON parse error
    }
    throw new Error(errMsg);
  }
  return res.json();
}

export const api = {
  // Health
  checkHealth: async () => {
    const res = await fetch(`${BASE_URL}/health`);
    return handleResponse<{ status: string; app: string; version: string }>(res);
  },

  // Browser
  getBrowserStatus: async (): Promise<BrowserStatus> => {
    const res = await fetch(`${BASE_URL}/browser/status`);
    return handleResponse<BrowserStatus>(res);
  },

  launchBrowser: async (headless = false): Promise<BrowserStatus> => {
    const res = await fetch(`${BASE_URL}/browser/launch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ headless }),
    });
    return handleResponse<BrowserStatus>(res);
  },

  closeBrowser: async (): Promise<BrowserStatus> => {
    const res = await fetch(`${BASE_URL}/browser/close`, { method: 'POST' });
    return handleResponse<BrowserStatus>(res);
  },

  captureCurrentPage: async (): Promise<{ url: string; title: string; html: string; is_challenge_detected: boolean }> => {
    const res = await fetch(`${BASE_URL}/browser/capture`, { method: 'POST' });
    return handleResponse<{ url: string; title: string; html: string; is_challenge_detected: boolean }>(res);
  },

  navigateBrowser: async (url: string): Promise<{ url: string; title: string }> => {
    const res = await fetch(`${BASE_URL}/browser/navigate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    });
    return handleResponse<{ url: string; title: string }>(res);
  },

  // Autonomous Agent & Orchestrator
  discoverTasks: async (payload?: { raw_html?: string; source_url?: string }): Promise<AssignmentBatch> => {
    const res = await fetch(`${BASE_URL}/agent/discover`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload || {}),
    });
    return handleResponse<AssignmentBatch>(res);
  },

  getBatches: async (): Promise<AssignmentBatch[]> => {
    const res = await fetch(`${BASE_URL}/agent/batches`);
    return handleResponse<AssignmentBatch[]>(res);
  },

  getBatch: async (batchId: number): Promise<AssignmentBatch> => {
    const res = await fetch(`${BASE_URL}/agent/batches/${batchId}`);
    return handleResponse<AssignmentBatch>(res);
  },

  selectTasks: async (batchId: number, taskIds: number[]): Promise<AssignmentTask[]> => {
    const res = await fetch(`${BASE_URL}/agent/batches/${batchId}/tasks/select`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ task_ids: taskIds }),
    });
    return handleResponse<AssignmentTask[]>(res);
  },

  updateTaskPermission: async (
    taskId: number,
    data: {
      assistance_status: string;
      automated_submission_allowed: boolean;
      permission_source: string;
      task_mode: string;
    }
  ): Promise<TaskPermission> => {
    const res = await fetch(`${BASE_URL}/agent/tasks/${taskId}/permission`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return handleResponse<TaskPermission>(res);
  },

  getTask: async (taskId: number): Promise<AssignmentTask> => {
    const res = await fetch(`${BASE_URL}/agent/tasks/${taskId}`);
    return handleResponse<AssignmentTask>(res);
  },

  startTask: async (taskId: number): Promise<AssignmentTask> => {
    const res = await fetch(`${BASE_URL}/agent/tasks/${taskId}/start`, {
      method: 'POST',
    });
    return handleResponse<AssignmentTask>(res);
  },

  pauseTask: async (taskId: number): Promise<AssignmentTask> => {
    const res = await fetch(`${BASE_URL}/agent/tasks/${taskId}/pause`, {
      method: 'POST',
    });
    return handleResponse<AssignmentTask>(res);
  },

  resumeTask: async (taskId: number): Promise<AssignmentTask> => {
    const res = await fetch(`${BASE_URL}/agent/tasks/${taskId}/resume`, {
      method: 'POST',
    });
    return handleResponse<AssignmentTask>(res);
  },

  cancelTask: async (taskId: number): Promise<AssignmentTask> => {
    const res = await fetch(`${BASE_URL}/agent/tasks/${taskId}/cancel`, {
      method: 'POST',
    });
    return handleResponse<AssignmentTask>(res);
  },

  getTaskEvents: async (taskId: number): Promise<AgentEvent[]> => {
    const res = await fetch(`${BASE_URL}/agent/tasks/${taskId}/events`);
    return handleResponse<AgentEvent[]>(res);
  },

  prepareSubmission: async (taskId: number): Promise<PrepareSubmissionResponse> => {
    const res = await fetch(`${BASE_URL}/agent/tasks/${taskId}/submission/prepare`, {
      method: 'POST',
    });
    return handleResponse<PrepareSubmissionResponse>(res);
  },

  confirmSubmission: async (taskId: number, confirmationToken: string): Promise<any> => {
    const res = await fetch(`${BASE_URL}/agent/tasks/${taskId}/submission/confirm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ confirmation_token: confirmationToken }),
    });
    return handleResponse<any>(res);
  },

  getSubmissionStatus: async (taskId: number): Promise<any> => {
    const res = await fetch(`${BASE_URL}/agent/tasks/${taskId}/submission/status`);
    return handleResponse<any>(res);
  },

  emergencyStop: async (): Promise<any> => {
    const res = await fetch(`${BASE_URL}/agent/queue/stop`, {
      method: 'POST',
    });
    return handleResponse<any>(res);
  },

  clearQueue: async (): Promise<any> => {
    const res = await fetch(`${BASE_URL}/agent/queue/clear`, {
      method: 'POST',
    });
    return handleResponse<any>(res);
  },

  // Problems
  parseProblem: async (payload: { raw_html?: string; url?: string; manual_statement?: string; manual_title?: string }): Promise<Problem> => {
    const res = await fetch(`${BASE_URL}/problems/parse`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return handleResponse<Problem>(res);
  },

  getProblems: async (): Promise<Problem[]> => {
    const res = await fetch(`${BASE_URL}/problems`);
    return handleResponse<Problem[]>(res);
  },

  getProblem: async (id: number): Promise<Problem> => {
    const res = await fetch(`${BASE_URL}/problems/${id}`);
    return handleResponse<Problem>(res);
  },

  updateProblem: async (id: number, data: Partial<Problem>): Promise<Problem> => {
    const res = await fetch(`${BASE_URL}/problems/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return handleResponse<Problem>(res);
  },

  // Drafts
  createDraft: async (data: { problem_id?: number; language: string; source_code: string; mode: AppMode }): Promise<Draft> => {
    const res = await fetch(`${BASE_URL}/drafts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return handleResponse<Draft>(res);
  },

  getDraftForProblem: async (problemId: number): Promise<Draft | null> => {
    const res = await fetch(`${BASE_URL}/drafts/problem/${problemId}`);
    return handleResponse<Draft | null>(res);
  },

  updateDraft: async (draftId: number, data: { source_code?: string; language?: string; mode?: string }): Promise<Draft> => {
    const res = await fetch(`${BASE_URL}/drafts/${draftId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return handleResponse<Draft>(res);
  },

  // Assistant
  explainProblem: async (payload: { problem_id?: number; statement?: string }): Promise<AssistantMessage> => {
    const res = await fetch(`${BASE_URL}/assistant/explain`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return handleResponse<AssistantMessage>(res);
  },

  getHint: async (payload: { problem_id?: number; current_code?: string; hint_level: number }): Promise<AssistantMessage> => {
    const res = await fetch(`${BASE_URL}/assistant/hint`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return handleResponse<AssistantMessage>(res);
  },

  discussApproach: async (payload: { problem_id?: number }): Promise<AssistantMessage> => {
    const res = await fetch(`${BASE_URL}/assistant/approach`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return handleResponse<AssistantMessage>(res);
  },

  reviewCode: async (payload: { problem_id?: number; source_code: string; language?: string }): Promise<AssistantMessage> => {
    const res = await fetch(`${BASE_URL}/assistant/review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return handleResponse<AssistantMessage>(res);
  },

  debugError: async (payload: { problem_id?: number; source_code: string; compiler_error?: string; runtime_error?: string }): Promise<AssistantMessage> => {
    const res = await fetch(`${BASE_URL}/assistant/debug`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return handleResponse<AssistantMessage>(res);
  },

  generatePracticeSolution: async (payload: { problem_id?: number; user_confirmed_allowed: boolean }): Promise<AssistantMessage> => {
    const res = await fetch(`${BASE_URL}/assistant/practice-solution`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return handleResponse<AssistantMessage>(res);
  },

  // Execution
  runCode: async (payload: { language: string; source_code: string; tests: TestCase[]; draft_id?: number }): Promise<ExecutionResponse> => {
    const res = await fetch(`${BASE_URL}/execution/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return handleResponse<ExecutionResponse>(res);
  },

  // History
  getHistory: async (): Promise<HistoryData> => {
    const res = await fetch(`${BASE_URL}/history`);
    return handleResponse<HistoryData>(res);
  },

  // Settings
  getSettings: async (): Promise<UserSettings> => {
    const res = await fetch(`${BASE_URL}/settings`);
    return handleResponse<UserSettings>(res);
  },

  updateSettings: async (data: Partial<UserSettings>): Promise<UserSettings> => {
    const res = await fetch(`${BASE_URL}/settings`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return handleResponse<UserSettings>(res);
  },
};
