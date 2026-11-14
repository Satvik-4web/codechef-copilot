export type AppMode = 'learning' | 'practice';

export type TaskAssistanceStatus = 'unknown' | 'learning_only' | 'ai_assistance_allowed';
export type TaskMode = 'learning' | 'authorized_practice';

export interface TaskPermission {
  assistance_status: TaskAssistanceStatus;
  automated_submission_allowed: boolean;
  permission_source: string;
  confirmed_at: string | null;
  last_confirmed_at: string | null;
  task_mode: TaskMode;
}

export type FSMState =
  | 'DISCOVERED'
  | 'NEEDS_PERMISSION_CONFIRMATION'
  | 'QUEUED'
  | 'OPENING_PROBLEM'
  | 'PARSING_PROBLEM'
  | 'NEEDS_PROBLEM_REVIEW'
  | 'ANALYZING'
  | 'DRAFTING'
  | 'COMPILING'
  | 'TESTING'
  | 'DEBUGGING'
  | 'READY_FOR_REVIEW'
  | 'NEEDS_SUBMISSION_PERMISSION'
  | 'NEEDS_SUBMISSION_CONFIRMATION'
  | 'SUBMITTING'
  | 'VERIFYING_VERDICT'
  | 'COMPLETED'
  | 'FAILED'
  | 'PAUSED'
  | 'CANCELLED';

export interface AssignmentTask {
  id: number;
  batch_id: number;
  problem_id: number | null;
  title: string;
  url: string;
  visible_status: string;
  course_group: string;
  state: FSMState;
  current_phase: string;
  last_error: string | null;
  permission?: TaskPermission;
  created_at: string;
  updated_at: string;
}

export interface AssignmentBatch {
  id: number;
  source_url: string;
  status: string;
  tasks: AssignmentTask[];
  created_at: string;
  updated_at: string;
}

export interface AgentEvent {
  id: number;
  task_id: number | null;
  agent_run_id: number | null;
  event_type: string;
  message: string;
  metadata_json: string;
  created_at: string;
}

export interface PrepareSubmissionResponse {
  task_id: number;
  draft_id: number;
  title: string;
  destination_url: string;
  code_hash: string;
  code_snippet: string;
  confirmation_token: string;
  expires_in_seconds: number;
  disclaimer: string;
}

export interface TestCase {
  name: string;
  stdin: string;
  expected_stdout: string;
}

export interface Problem {
  id: number;
  title: string;
  source_url: string;
  statement: string;
  input_format: string;
  output_format: string;
  constraints: string;
  examples: TestCase[];
  parser_confidence: number;
  created_at: string;
  updated_at: string;
}

export interface Draft {
  id: number;
  problem_id: number | null;
  language: string;
  source_code: string;
  mode: AppMode;
  created_at: string;
  updated_at: string;
}

export interface BrowserStatus {
  running: boolean;
  current_url: string | null;
  current_title: string | null;
  is_challenge_detected: boolean;
  message: string;
}

export interface TestResult {
  name: string;
  passed: boolean;
  stdin: string;
  expected_stdout: string;
  actual_stdout: string;
  stderr: string;
  status: 'passed' | 'wrong_answer' | 'timeout' | 'runtime_error';
  duration_ms: number;
}

export interface ExecutionResponse {
  run_id: number;
  status: 'success' | 'compile_error' | 'runtime_error' | 'timeout' | 'output_mismatch' | 'docker_unavailable';
  compile_stdout: string;
  compile_stderr: string;
  results: TestResult[];
  duration_ms: number;
  is_docker_isolated: boolean;
  message: string;
}

export interface AssistantMessage {
  message: string;
  interaction_type: 'explain' | 'hint' | 'approach' | 'review' | 'debug' | 'practice_solution';
  hint_level?: number;
  generated_code?: string;
  is_ai_assisted: boolean;
  disclaimer?: string;
}

export interface HistoryData {
  problems: Array<{ id: number; title: string; source_url: string; created_at: string }>;
  drafts: Array<{ id: number; problem_id: number | null; language: string; mode: string; updated_at: string }>;
  runs: Array<{ id: number; draft_id: number | null; status: string; duration_ms: number; created_at: string }>;
  interactions: Array<{ id: number; problem_id: number | null; interaction_type: string; created_at: string }>;
}

export interface UserSettings {
  active_mode: AppMode;
  execution_timeout_seconds: number;
  execution_memory_mb: number;
  ai_provider: string;
  ai_model: string;
  docker_available: boolean;
}
