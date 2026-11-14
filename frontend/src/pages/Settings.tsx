import React, { useState, useEffect } from 'react';
import { UserSettings, AppMode } from '../types';
import {
  Settings,
  Shield,
  Server,
  Cpu,
  Sparkles,
  Save,
  Check,
  ServerOff,
  AlertCircle,
} from 'lucide-react';

interface SettingsProps {
  settings: UserSettings | null;
  onSaveSettings: (data: Partial<UserSettings>) => void;
  isSaving: boolean;
}

export const SettingsPage: React.FC<SettingsProps> = ({
  settings,
  onSaveSettings,
  isSaving,
}) => {
  const [activeMode, setActiveMode] = useState<AppMode>('learning');
  const [timeoutSec, setTimeoutSec] = useState<number>(5);
  const [memoryMb, setMemoryMb] = useState<number>(256);
  const [aiProvider, setAiProvider] = useState<string>('');
  const [aiModel, setAiModel] = useState<string>('');
  const [savedToast, setSavedToast] = useState(false);

  useEffect(() => {
    if (settings) {
      setActiveMode(settings.active_mode);
      setTimeoutSec(settings.execution_timeout_seconds);
      setMemoryMb(settings.execution_memory_mb);
      setAiProvider(settings.ai_provider || '');
      setAiModel(settings.ai_model || '');
    }
  }, [settings]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveSettings({
      active_mode: activeMode,
      execution_timeout_seconds: Number(timeoutSec),
      execution_memory_mb: Number(memoryMb),
      ai_provider: aiProvider,
      ai_model: aiModel,
    });
    setSavedToast(true);
    setTimeout(() => setSavedToast(false), 2000);
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6 max-w-4xl mx-auto w-full text-xs">
      <div className="border-b border-graphite-750 pb-4">
        <h2 className="text-xl font-bold text-white flex items-center space-x-2">
          <Settings className="w-5 h-5 text-brand-accent" />
          <span>Application Settings</span>
        </h2>
        <p className="text-slate-400 mt-1">
          Configure academic integrity modes, execution sandbox parameters, and AI model providers.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Sandbox Status Card */}
        <div className="bg-graphite-900 p-5 rounded-xl border border-graphite-750 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Server className="w-4 h-4 text-brand-accent" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">
                Docker Sandbox Isolation Status
              </h3>
            </div>
            <span
              className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono border ${
                settings?.docker_available
                  ? 'bg-emerald-950/60 border-emerald-800 text-emerald-400'
                  : 'bg-amber-950/60 border-amber-800 text-amber-400'
              }`}
            >
              {settings?.docker_available ? 'Docker Daemon Online' : 'Docker Daemon Offline'}
            </span>
          </div>

          <p className="text-slate-400 text-xs leading-relaxed">
            {settings?.docker_available
              ? 'Container engine detected. C++17 executions are strictly sandboxed with zero network access and hard resource ceilings.'
              : 'Docker is currently offline. Launch Docker Desktop on Windows to enable sandboxed C++17 compilation and execution. Host execution fallback is strictly prohibited.'}
          </p>
        </div>

        {/* Section 1: Academic Mode */}
        <div className="bg-graphite-900 p-5 rounded-xl border border-graphite-750 space-y-4">
          <div className="flex items-center space-x-2">
            <Shield className="w-4 h-4 text-brand-accent" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">
              Default Integrity Mode
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div
              onClick={() => setActiveMode('learning')}
              className={`p-4 rounded-lg border cursor-pointer transition-colors ${
                activeMode === 'learning'
                  ? 'bg-graphite-800 border-brand-500 shadow-sm'
                  : 'bg-graphite-850 border-graphite-750 hover:bg-graphite-800'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-bold text-slate-100">Learning Mode (Default)</span>
                {activeMode === 'learning' && (
                  <Check className="w-4 h-4 text-brand-accent" />
                )}
              </div>
              <p className="text-slate-400 text-[11px] leading-relaxed">
                Conceptual explanations, 3-tier graduated hints, complexity breakdowns, and code reviews. Full solution generation is strictly blocked.
              </p>
            </div>

            <div
              onClick={() => setActiveMode('practice')}
              className={`p-4 rounded-lg border cursor-pointer transition-colors ${
                activeMode === 'practice'
                  ? 'bg-graphite-800 border-amber-500 shadow-sm'
                  : 'bg-graphite-850 border-graphite-750 hover:bg-graphite-800'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-bold text-slate-100">Practice Mode</span>
                {activeMode === 'practice' && (
                  <Check className="w-4 h-4 text-amber-400" />
                )}
              </div>
              <p className="text-slate-400 text-[11px] leading-relaxed">
                Personal practice mode. Allows AI-assisted code generation only after explicit user confirmation of platform/course rule compliance.
              </p>
            </div>
          </div>
        </div>

        {/* Section 2: Sandbox Limits */}
        <div className="bg-graphite-900 p-5 rounded-xl border border-graphite-750 space-y-4">
          <div className="flex items-center space-x-2">
            <Cpu className="w-4 h-4 text-brand-accent" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">
              Sandbox Resource Limits
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-slate-400 mb-1">
                Wall-Clock Timeout (seconds)
              </label>
              <input
                type="number"
                min={1}
                max={30}
                value={timeoutSec}
                onChange={(e) => setTimeoutSec(Number(e.target.value))}
                className="w-full bg-graphite-850 border border-graphite-750 rounded p-2 text-slate-200 font-mono"
              />
              <span className="text-[10px] text-slate-500 mt-1 block">
                Standard CodeChef time limits are typically 1.0 - 2.0s.
              </span>
            </div>

            <div>
              <label className="block text-slate-400 mb-1">
                Memory Limit (MB)
              </label>
              <input
                type="number"
                min={64}
                max={1024}
                value={memoryMb}
                onChange={(e) => setMemoryMb(Number(e.target.value))}
                className="w-full bg-graphite-850 border border-graphite-750 rounded p-2 text-slate-200 font-mono"
              />
              <span className="text-[10px] text-slate-500 mt-1 block">
                Hard ceiling passed to Docker (<code className="text-slate-400 font-mono">--memory 256m</code>).
              </span>
            </div>
          </div>
        </div>

        {/* Section 3: AI Provider */}
        <div className="bg-graphite-900 p-5 rounded-xl border border-graphite-750 space-y-4">
          <div className="flex items-center space-x-2">
            <Sparkles className="w-4 h-4 text-brand-accent" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">
              AI Provider Configuration
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-slate-400 mb-1">Provider</label>
              <select
                value={aiProvider}
                onChange={(e) => setAiProvider(e.target.value)}
                className="w-full bg-graphite-850 border border-graphite-750 rounded p-2 text-slate-200"
              >
                <option value="">Offline Rule-Based Engine (No API Key Required)</option>
                <option value="gemini">Google Gemini</option>
                <option value="openai">OpenAI (GPT-4o / GPT-4o-mini)</option>
              </select>
              <span className="text-[10px] text-slate-500 mt-1 block">
                API keys are kept strictly in backend environment variables (.env) and are never exposed to the browser.
              </span>
            </div>

            <div>
              <label className="block text-slate-400 mb-1">Model Name (optional)</label>
              <input
                type="text"
                value={aiModel}
                onChange={(e) => setAiModel(e.target.value)}
                placeholder="e.g. gemini-1.5-flash or gpt-4o-mini"
                className="w-full bg-graphite-850 border border-graphite-750 rounded p-2 text-slate-200 font-mono"
              />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end space-x-3 pt-2">
          {savedToast && (
            <span className="text-emerald-400 text-xs flex items-center space-x-1">
              <Check className="w-4 h-4" />
              <span>Settings Saved</span>
            </span>
          )}
          <button
            type="submit"
            disabled={isSaving}
            className="px-5 py-2 bg-brand-600 hover:bg-brand-500 text-white rounded-lg font-semibold flex items-center space-x-2 transition-colors disabled:opacity-50 shadow-sm"
          >
            <Save className="w-4 h-4" />
            <span>{isSaving ? 'Saving...' : 'Save Settings'}</span>
          </button>
        </div>
      </form>
    </div>
  );
};
