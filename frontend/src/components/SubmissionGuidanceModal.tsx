import React, { useState, useEffect } from 'react';
import type { Problem, AssignmentTask, PrepareSubmissionResponse } from '../types';
import { api } from '../services/api';
import {
  ExternalLink,
  ShieldCheck,
  ShieldAlert,
  AlertCircle,
  X,
  FileCheck2,
  Send,
  Lock,
  Clock,
  Sparkles,
  Terminal,
} from 'lucide-react';

interface SubmissionGuidanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  problem: Problem | null;
  task?: AssignmentTask | null;
  onOpenManualSubmissionPage: () => void;
  isOpeningManual: boolean;
  onSubmissionSuccess?: (verdict: string) => void;
}

export const SubmissionGuidanceModal: React.FC<SubmissionGuidanceModalProps> = ({
  isOpen,
  onClose,
  problem,
  task,
  onOpenManualSubmissionPage,
  isOpeningManual,
  onSubmissionSuccess,
}) => {
  // Manual checklist states
  const [understoodCode, setUnderstoodCode] = useState(false);
  const [compliesRules, setCompliesRules] = useState(false);
  const [testedEdgeCases, setTestedEdgeCases] = useState(false);

  // Automated submission gating states
  const [prepData, setPrepData] = useState<PrepareSubmissionResponse | null>(null);
  const [isPreparing, setIsPreparing] = useState(false);
  const [prepError, setPrepError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [subResult, setSubResult] = useState<any>(null);

  const isAutoSubAllowed = task?.permission?.automated_submission_allowed === true;

  useEffect(() => {
    if (isOpen && task && isAutoSubAllowed) {
      handlePrepareAutoSubmission();
    } else {
      setPrepData(null);
      setPrepError(null);
      setSubResult(null);
    }
  }, [isOpen, task?.id, isAutoSubAllowed]);

  if (!isOpen) return null;

  const handlePrepareAutoSubmission = async () => {
    if (!task) return;
    setIsPreparing(true);
    setPrepError(null);
    try {
      const res = await api.prepareSubmission(task.id);
      setPrepData(res);
    } catch (err: any) {
      setPrepError(err.message);
    } finally {
      setIsPreparing(false);
    }
  };

  const handleConfirmAutoSubmission = async () => {
    if (!task || !prepData) return;
    setIsSubmitting(true);
    try {
      const res = await api.confirmSubmission(task.id, prepData.confirmation_token);
      setSubResult(res);
      if (onSubmissionSuccess) {
        onSubmissionSuccess(res.visible_verdict || 'PENDING');
      }
    } catch (err: any) {
      alert(`Submission error: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const canNavigateManual = understoodCode && compliesRules && testedEdgeCases;

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-graphite-900 border border-graphite-700 rounded-xl max-w-lg w-full overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="p-4 border-b border-graphite-750 bg-graphite-850 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <ShieldCheck className="w-5 h-5 text-brand-accent" />
            <h3 className="text-sm font-bold text-slate-100">
              {isAutoSubAllowed ? 'Authorized Submission Review & Execution' : 'Manual Submission Guidance & Checklist'}
            </h3>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-200 rounded">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-4 text-xs text-slate-300">
          {/* Automated submission branch if authorized */}
          {isAutoSubAllowed ? (
            <div className="space-y-3">
              <div className="p-3 bg-brand-950/40 border border-brand-800/50 rounded-lg flex items-start space-x-2.5">
                <Sparkles className="w-4 h-4 text-brand-accent mt-0.5 flex-shrink-0" />
                <div>
                  <span className="font-semibold text-slate-200">
                    Automated Browser Submission Authorized
                  </span>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Permission verified for practice task. A short-lived, single-use token has been bound to your code hash.
                  </p>
                </div>
              </div>

              {isPreparing ? (
                <div className="p-6 text-center text-slate-400 space-y-2">
                  <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto" />
                  <p className="text-[11px]">Preparing cryptographic submission token...</p>
                </div>
              ) : prepError ? (
                <div className="p-3 bg-rose-950/40 border border-rose-800 rounded-lg text-rose-300 space-y-1">
                  <div className="font-semibold flex items-center space-x-1.5">
                    <ShieldAlert className="w-4 h-4" />
                    <span>Submission Authorization Refused</span>
                  </div>
                  <p className="text-[11px]">{prepError}</p>
                </div>
              ) : prepData ? (
                <div className="space-y-3">
                  <div className="bg-graphite-850 p-3 rounded-lg border border-graphite-750 space-y-2 font-mono text-[11px]">
                    <div className="flex justify-between text-slate-400">
                      <span>Destination:</span>
                      <span className="text-slate-200 truncate max-w-[260px]">{prepData.destination_url}</span>
                    </div>
                    <div className="flex justify-between text-slate-400">
                      <span>Code SHA-256:</span>
                      <span className="text-brand-accent truncate max-w-[260px]">{prepData.code_hash.slice(0, 16)}...</span>
                    </div>
                    <div className="flex justify-between text-slate-400">
                      <span>Token TTL:</span>
                      <span className="text-emerald-400 flex items-center space-x-1">
                        <Clock className="w-3 h-3" />
                        <span>Valid for 5 mins</span>
                      </span>
                    </div>
                  </div>

                  <div className="p-2.5 bg-graphite-950 rounded border border-graphite-750 font-mono text-[10px] text-slate-300 max-h-24 overflow-y-auto whitespace-pre-wrap">
                    {prepData.code_snippet}
                  </div>

                  {subResult ? (
                    <div className="p-3 bg-emerald-950/40 border border-emerald-800 rounded-lg text-emerald-300 space-y-1 font-mono">
                      <div className="font-bold">VERDICT: {subResult.visible_verdict}</div>
                      <p className="text-[11px] font-sans text-slate-300">{subResult.message}</p>
                    </div>
                  ) : (
                    <div className="p-2.5 bg-amber-950/20 border border-amber-800/40 rounded text-amber-300 text-[11px] flex items-start space-x-2">
                      <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                      <span>
                        Clicking <strong>Confirm & Submit</strong> will paste the code and activate the submit control in the dedicated browser window.
                      </span>
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          ) : (
            /* Manual submission checklist branch */
            <div className="space-y-3">
              <div className="p-3 bg-brand-950/40 border border-brand-800/50 rounded-lg flex items-start space-x-2.5">
                <FileCheck2 className="w-4 h-4 text-brand-accent mt-0.5 flex-shrink-0" />
                <div>
                  <span className="font-semibold text-slate-200">
                    You are in full control.
                  </span>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Automated submission is not authorized for this task. Review your solution, confirm the checklist, and navigate to the platform to submit manually.
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Pre-Submission Verification Checklist
                </h4>

                <label className="flex items-start space-x-2.5 p-2.5 rounded-lg bg-graphite-850 border border-graphite-750 cursor-pointer hover:bg-graphite-800 transition-colors">
                  <input
                    type="checkbox"
                    checked={understoodCode}
                    onChange={(e) => setUnderstoodCode(e.target.checked)}
                    className="mt-0.5 rounded border-graphite-700 text-brand-600 focus:ring-0 bg-graphite-900"
                  />
                  <span className="text-[11px] text-slate-200">
                    I understand every line and data structure used in this solution.
                  </span>
                </label>

                <label className="flex items-start space-x-2.5 p-2.5 rounded-lg bg-graphite-850 border border-graphite-750 cursor-pointer hover:bg-graphite-800 transition-colors">
                  <input
                    type="checkbox"
                    checked={compliesRules}
                    onChange={(e) => setCompliesRules(e.target.checked)}
                    className="mt-0.5 rounded border-graphite-700 text-brand-600 focus:ring-0 bg-graphite-900"
                  />
                  <span className="text-[11px] text-slate-200">
                    I have verified that this submission complies with the applicable contest, coursework, and platform integrity rules.
                  </span>
                </label>

                <label className="flex items-start space-x-2.5 p-2.5 rounded-lg bg-graphite-850 border border-graphite-750 cursor-pointer hover:bg-graphite-800 transition-colors">
                  <input
                    type="checkbox"
                    checked={testedEdgeCases}
                    onChange={(e) => setTestedEdgeCases(e.target.checked)}
                    className="mt-0.5 rounded border-graphite-700 text-brand-600 focus:ring-0 bg-graphite-900"
                  />
                  <span className="text-[11px] text-slate-200">
                    I have tested boundary edge cases ($N=1$, overflow limits, empty inputs).
                  </span>
                </label>
              </div>

              <div className="p-3 bg-amber-950/20 border border-amber-800/40 rounded-lg text-amber-300 text-[11px] flex items-start space-x-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>
                  <strong>Notice:</strong> The browser will navigate to CodeChef&apos;s submission interface. You will review and click Submit yourself.
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-graphite-750 bg-graphite-850 flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-3 py-1.5 bg-graphite-800 hover:bg-graphite-750 text-slate-300 rounded text-xs transition-colors"
          >
            Close
          </button>

          {isAutoSubAllowed && prepData && !subResult ? (
            <button
              onClick={handleConfirmAutoSubmission}
              disabled={isSubmitting}
              className="px-4 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded text-xs font-semibold flex items-center space-x-1.5 transition-colors disabled:opacity-40 shadow-sm"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{isSubmitting ? 'Submitting in Browser...' : 'Confirm & Execute Submission'}</span>
            </button>
          ) : !isAutoSubAllowed ? (
            <button
              onClick={onOpenManualSubmissionPage}
              disabled={!canNavigateManual || isOpeningManual}
              className="px-4 py-1.5 bg-brand-600 hover:bg-brand-500 text-white rounded text-xs font-semibold flex items-center space-x-1.5 transition-colors disabled:opacity-40 shadow-sm"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>{isOpeningManual ? 'Opening Browser...' : 'Open Submission Page in Browser'}</span>
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
};
