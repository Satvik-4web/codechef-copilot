import React, { useRef } from 'react';
import Editor, { OnMount } from '@monaco-editor/react';
import { Save, RotateCcw, Check, Sparkles } from 'lucide-react';

interface CodeEditorProps {
  code: string;
  onChange: (value: string) => void;
  onSaveDraft: () => void;
  isSaving: boolean;
  hasSaved: boolean;
  onResetCode: () => void;
  language?: string;
}

export const MonacoCodeEditor: React.FC<CodeEditorProps> = ({
  code,
  onChange,
  onSaveDraft,
  isSaving,
  hasSaved,
  onResetCode,
  language = 'cpp',
}) => {
  const editorRef = useRef<any>(null);

  const handleEditorDidMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
  };

  return (
    <div className="h-full flex flex-col bg-graphite-950 overflow-hidden">
      {/* Editor Toolbar */}
      <div className="h-10 border-b border-graphite-750 bg-graphite-900 px-3 flex items-center justify-between select-none">
        <div className="flex items-center space-x-2">
          <span className="text-xs font-mono font-semibold text-slate-300">
            solution.cpp
          </span>
          <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-graphite-800 text-brand-accent border border-graphite-700">
            C++17
          </span>
        </div>

        <div className="flex items-center space-x-1.5">
          <button
            onClick={onResetCode}
            className="px-2 py-1 bg-graphite-800 hover:bg-graphite-750 text-slate-300 rounded text-xs flex items-center space-x-1 transition-colors"
            title="Reset to clean competitive programming template"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Reset</span>
          </button>
          <button
            onClick={onSaveDraft}
            disabled={isSaving}
            className="px-2.5 py-1 bg-brand-600 hover:bg-brand-500 text-white rounded text-xs font-medium flex items-center space-x-1 transition-colors disabled:opacity-50"
            title="Save draft locally to SQLite"
          >
            {hasSaved ? (
              <>
                <Check className="w-3 h-3 text-emerald-300" />
                <span>Saved</span>
              </>
            ) : (
              <>
                <Save className="w-3 h-3" />
                <span>{isSaving ? 'Saving...' : 'Save Draft'}</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Monaco Container */}
      <div className="flex-1 w-full">
        <Editor
          height="100%"
          language={language === 'cpp17' ? 'cpp' : language}
          value={code}
          theme="vs-dark"
          onChange={(val) => onChange(val || '')}
          onMount={handleEditorDidMount}
          options={{
            fontSize: 13,
            fontFamily: "'Fira Code', 'JetBrains Mono', Consolas, monospace",
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            automaticLayout: true,
            tabSize: 4,
            lineNumbers: 'on',
            lineDecorationsWidth: 10,
            lineNumbersMinChars: 3,
            renderWhitespace: 'selection',
            smoothScrolling: true,
            cursorBlinking: 'smooth',
          }}
        />
      </div>
    </div>
  );
};
