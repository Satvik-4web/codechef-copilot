import React, { useState } from 'react';
import { Problem } from '../../types';
import {
  ExternalLink,
  Edit3,
  CheckCircle2,
  Copy,
  Check,
  AlertCircle,
  FileText,
} from 'lucide-react';

interface ProblemStatementPanelProps {
  problem: Problem | null;
  onEditProblem: () => void;
}

export const ProblemStatementPanel: React.FC<ProblemStatementPanelProps> = ({
  problem,
  onEditProblem,
}) => {
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

  if (!problem) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-6 text-center text-slate-400 bg-graphite-900 border-r border-graphite-750">
        <FileText className="w-12 h-12 text-slate-600 mb-3" />
        <h3 className="text-base font-semibold text-slate-300">No Problem Loaded</h3>
        <p className="text-xs text-slate-500 max-w-xs mt-1">
          Launch the dedicated browser and capture an active CodeChef problem, or paste a problem manually.
        </p>
        <button
          onClick={onEditProblem}
          className="mt-4 px-3 py-1.5 bg-brand-600 hover:bg-brand-500 text-white rounded-lg text-xs font-medium transition-colors"
        >
          Create / Paste Task Manually
        </button>
      </div>
    );
  }

  const copyToClipboard = (text: string, idx: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 1500);
  };

  const confidencePct = Math.round(problem.parser_confidence * 100);

  return (
    <div className="h-full flex flex-col bg-graphite-900 border-r border-graphite-750 overflow-hidden">
      {/* Problem Header */}
      <div className="p-4 border-b border-graphite-750 bg-graphite-850/50">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h2 className="text-base font-bold text-slate-100 leading-snug">
              {problem.title}
            </h2>
            {problem.source_url && (
              <a
                href={problem.source_url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center space-x-1 text-[11px] text-brand-accent hover:underline mt-1 font-mono"
              >
                <span>CodeChef Link</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>

          <div className="flex items-center space-x-1.5">
            <span
              className={`text-[11px] font-mono px-2 py-0.5 rounded-full border ${
                confidencePct >= 70
                  ? 'bg-emerald-950/60 border-emerald-800 text-emerald-400'
                  : 'bg-amber-950/60 border-amber-800 text-amber-400'
              }`}
              title="Confidence score of DOM parsing"
            >
              {confidencePct}% Confidence
            </span>
            <button
              onClick={onEditProblem}
              className="p-1 hover:bg-graphite-750 text-slate-400 hover:text-slate-200 rounded transition-colors"
              title="Edit or adjust parsed problem details"
            >
              <Edit3 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Problem Body (Scrollable) */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5 text-slate-300 text-xs leading-relaxed">
        {/* Statement */}
        <section>
          <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
            Statement
          </h4>
          <div className="bg-graphite-850 p-3 rounded-lg border border-graphite-750 whitespace-pre-wrap font-sans text-slate-200">
            {problem.statement}
          </div>
        </section>

        {/* Input & Output Format */}
        <div className="grid grid-cols-1 gap-3">
          <section>
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
              Input Format
            </h4>
            <div className="bg-graphite-850 p-2.5 rounded-lg border border-graphite-750 whitespace-pre-wrap text-slate-300">
              {problem.input_format}
            </div>
          </section>

          <section>
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
              Output Format
            </h4>
            <div className="bg-graphite-850 p-2.5 rounded-lg border border-graphite-750 whitespace-pre-wrap text-slate-300">
              {problem.output_format}
            </div>
          </section>
        </div>

        {/* Constraints */}
        <section>
          <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
            Constraints
          </h4>
          <div className="bg-graphite-850 p-2.5 rounded-lg border border-graphite-750 font-mono text-[11px] text-slate-300 whitespace-pre-wrap">
            {problem.constraints}
          </div>
        </section>

        {/* Sample Test Cases */}
        <section>
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Sample Test Cases ({problem.examples?.length || 0})
            </h4>
          </div>

          <div className="space-y-3">
            {problem.examples && problem.examples.length > 0 ? (
              problem.examples.map((ex, idx) => (
                <div
                  key={idx}
                  className="bg-graphite-850 rounded-lg border border-graphite-750 overflow-hidden"
                >
                  <div className="px-3 py-1.5 bg-graphite-800 border-b border-graphite-750 flex items-center justify-between">
                    <span className="text-[11px] font-medium text-slate-200">
                      {ex.name || `Sample ${idx + 1}`}
                    </span>
                    <button
                      onClick={() => copyToClipboard(ex.stdin, idx)}
                      className="flex items-center space-x-1 text-[10px] text-slate-400 hover:text-slate-200"
                    >
                      {copiedIdx === idx ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-400" />
                          <span className="text-emerald-400">Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          <span>Copy Input</span>
                        </>
                      )}
                    </button>
                  </div>

                  <div className="grid grid-cols-2 divide-x divide-graphite-750">
                    <div className="p-2.5">
                      <div className="text-[10px] text-slate-400 uppercase font-mono mb-1">
                        Input
                      </div>
                      <pre className="font-mono text-[11px] text-slate-200 whitespace-pre-wrap">
                        {ex.stdin || '<empty>'}
                      </pre>
                    </div>
                    <div className="p-2.5">
                      <div className="text-[10px] text-slate-400 uppercase font-mono mb-1">
                        Expected Output
                      </div>
                      <pre className="font-mono text-[11px] text-slate-200 whitespace-pre-wrap">
                        {ex.expected_stdout || '<empty>'}
                      </pre>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-slate-500 text-xs italic">No sample test cases detected.</div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
};
