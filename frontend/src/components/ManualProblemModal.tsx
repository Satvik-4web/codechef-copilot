import React, { useState, useEffect } from 'react';
import { Problem, TestCase } from '../types';
import { X, Plus, Trash2, Save, FileText } from 'lucide-react';

interface ManualProblemModalProps {
  isOpen: boolean;
  onClose: () => void;
  problem: Problem | null;
  onSave: (data: {
    title: string;
    source_url: string;
    statement: string;
    input_format: string;
    output_format: string;
    constraints: string;
    examples: TestCase[];
  }) => void;
}

export const ManualProblemModal: React.FC<ManualProblemModalProps> = ({
  isOpen,
  onClose,
  problem,
  onSave,
}) => {
  const [title, setTitle] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [statement, setStatement] = useState('');
  const [inputFormat, setInputFormat] = useState('');
  const [outputFormat, setOutputFormat] = useState('');
  const [constraints, setConstraints] = useState('');
  const [examples, setExamples] = useState<TestCase[]>([
    { name: 'Sample 1', stdin: '', expected_stdout: '' },
  ]);

  useEffect(() => {
    if (problem) {
      setTitle(problem.title || '');
      setSourceUrl(problem.source_url || '');
      setStatement(problem.statement || '');
      setInputFormat(problem.input_format || '');
      setOutputFormat(problem.output_format || '');
      setConstraints(problem.constraints || '');
      setExamples(
        problem.examples && problem.examples.length > 0
          ? problem.examples
          : [{ name: 'Sample 1', stdin: '', expected_stdout: '' }]
      );
    } else {
      setTitle('Custom CodeChef Practice Problem');
      setSourceUrl('');
      setStatement('');
      setInputFormat('');
      setOutputFormat('');
      setConstraints('');
      setExamples([{ name: 'Sample 1', stdin: '', expected_stdout: '' }]);
    }
  }, [problem, isOpen]);

  if (!isOpen) return null;

  const handleAddExample = () => {
    setExamples([
      ...examples,
      { name: `Sample ${examples.length + 1}`, stdin: '', expected_stdout: '' },
    ]);
  };

  const handleUpdateExample = (idx: number, field: keyof TestCase, val: string) => {
    const updated = [...examples];
    updated[idx] = { ...updated[idx], [field]: val };
    setExamples(updated);
  };

  const handleDeleteExample = (idx: number) => {
    if (examples.length > 1) {
      setExamples(examples.filter((_, i) => i !== idx));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      title: title.trim() || 'Untitled Practice Problem',
      source_url: sourceUrl.trim(),
      statement: statement.trim(),
      input_format: inputFormat.trim(),
      output_format: outputFormat.trim(),
      constraints: constraints.trim(),
      examples,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-graphite-900 border border-graphite-700 rounded-xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-4 border-b border-graphite-750 bg-graphite-850 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <FileText className="w-4 h-4 text-brand-accent" />
            <h3 className="text-sm font-bold text-slate-100">
              {problem ? 'Edit Problem Specification' : 'Manual Problem Input Fallback'}
            </h3>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-200 rounded">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
          <div>
            <label className="block text-slate-400 font-medium mb-1">Problem Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-graphite-850 border border-graphite-750 rounded p-2 text-slate-200 focus:outline-none focus:border-brand-500"
              placeholder="e.g. ATM Machine"
              required
            />
          </div>

          <div>
            <label className="block text-slate-400 font-medium mb-1">Source URL (optional)</label>
            <input
              type="url"
              value={sourceUrl}
              onChange={(e) => setSourceUrl(e.target.value)}
              className="w-full bg-graphite-850 border border-graphite-750 rounded p-2 text-slate-200 focus:outline-none focus:border-brand-500"
              placeholder="https://www.codechef.com/problems/..."
            />
          </div>

          <div>
            <label className="block text-slate-400 font-medium mb-1">Problem Statement</label>
            <textarea
              rows={4}
              value={statement}
              onChange={(e) => setStatement(e.target.value)}
              className="w-full bg-graphite-850 border border-graphite-750 rounded p-2 text-slate-200 focus:outline-none focus:border-brand-500 resize-y"
              placeholder="Paste the problem statement here..."
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-400 font-medium mb-1">Input Format</label>
              <textarea
                rows={3}
                value={inputFormat}
                onChange={(e) => setInputFormat(e.target.value)}
                className="w-full bg-graphite-850 border border-graphite-750 rounded p-2 text-slate-200 focus:outline-none focus:border-brand-500"
                placeholder="First line contains T..."
              />
            </div>
            <div>
              <label className="block text-slate-400 font-medium mb-1">Output Format</label>
              <textarea
                rows={3}
                value={outputFormat}
                onChange={(e) => setOutputFormat(e.target.value)}
                className="w-full bg-graphite-850 border border-graphite-750 rounded p-2 text-slate-200 focus:outline-none focus:border-brand-500"
                placeholder="Output a single line..."
              />
            </div>
          </div>

          <div>
            <label className="block text-slate-400 font-medium mb-1">Constraints</label>
            <textarea
              rows={2}
              value={constraints}
              onChange={(e) => setConstraints(e.target.value)}
              className="w-full bg-graphite-850 border border-graphite-750 rounded p-2 text-slate-200 focus:outline-none focus:border-brand-500 font-mono"
              placeholder="1 <= T <= 100..."
            />
          </div>

          {/* Sample Test Cases */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-slate-400 font-medium">Sample Test Cases</label>
              <button
                type="button"
                onClick={handleAddExample}
                className="text-[11px] text-brand-accent hover:underline flex items-center space-x-1"
              >
                <Plus className="w-3 h-3" />
                <span>Add Sample</span>
              </button>
            </div>

            <div className="space-y-3">
              {examples.map((ex, idx) => (
                <div key={idx} className="p-3 bg-graphite-850 rounded border border-graphite-750">
                  <div className="flex items-center justify-between mb-2">
                    <input
                      type="text"
                      value={ex.name}
                      onChange={(e) => handleUpdateExample(idx, 'name', e.target.value)}
                      className="bg-transparent font-medium text-slate-200 text-xs focus:outline-none"
                    />
                    {examples.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleDeleteExample(idx)}
                        className="text-slate-500 hover:text-rose-400"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <textarea
                      rows={2}
                      value={ex.stdin}
                      onChange={(e) => handleUpdateExample(idx, 'stdin', e.target.value)}
                      placeholder="Sample Input (stdin)"
                      className="bg-graphite-900 border border-graphite-750 rounded p-1.5 font-mono text-[11px] text-slate-200"
                    />
                    <textarea
                      rows={2}
                      value={ex.expected_stdout}
                      onChange={(e) => handleUpdateExample(idx, 'expected_stdout', e.target.value)}
                      placeholder="Expected Output (stdout)"
                      className="bg-graphite-900 border border-graphite-750 rounded p-1.5 font-mono text-[11px] text-slate-200"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-2 flex justify-end space-x-2 border-t border-graphite-750">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 bg-graphite-800 hover:bg-graphite-750 text-slate-300 rounded text-xs"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 bg-brand-600 hover:bg-brand-500 text-white rounded text-xs font-semibold flex items-center space-x-1.5"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Save & Use Problem</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
