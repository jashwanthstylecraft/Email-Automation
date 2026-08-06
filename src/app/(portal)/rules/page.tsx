'use client';

import React, { useEffect, useState } from 'react';
import { useStore } from '@/lib/store';
import {
  Sliders, Plus, Trash2, ToggleLeft, ToggleRight, Check, X,
  HelpCircle, SlidersHorizontal, ArrowRight, Play, Info
} from 'lucide-react';

export default function RulesPage() {
  const {
    rules, templates, fetchRules, fetchTemplates,
    saveRule, deleteRule, user
  } = useStore();

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [ruleName, setRuleName] = useState('');
  const [active, setActive] = useState(true);

  // Simple rule condition
  const [condField, setCondField] = useState<'category' | 'sentiment' | 'priority' | 'body' | 'subject'>('category');
  const [condOperator, setCondOperator] = useState<'equals' | 'contains' | 'contains_any' | 'not_equals'>('equals');
  const [condValue, setCondValue] = useState('');

  // Simple rule action
  const [actionType, setActionType] = useState<'AUTO_REPLY' | 'REPLY_TEMPLATE' | 'ESCALATE'>('AUTO_REPLY');
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('WAITING');
  const [assignee, setAssignee] = useState('');

  // Advanced Intent Matching Parameters
  const [confidenceThreshold, setConfidenceThreshold] = useState(85);
  const [autoDraft, setAutoDraft] = useState(true);
  const [autoSend, setAutoSend] = useState(false);
  const [manualReviewFallback, setManualReviewFallback] = useState(true);

  useEffect(() => {
    fetchRules();
    fetchTemplates();
  }, []);

  const handleCreateRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ruleName.trim()) return;

    const conditions = {
      logic: 'AND',
      rules: [
        { field: condField, operator: condOperator, value: condValue }
      ]
    };

    const actions = {
      actionType,
      templateId: actionType !== 'ESCALATE' ? selectedTemplateId : undefined,
      status: actionType !== 'ESCALATE' ? selectedStatus : 'ESCALATED',
      assignee: actionType === 'ESCALATE' ? assignee : undefined,
      confidenceThreshold: confidenceThreshold / 100,
      autoDraft,
      autoSend,
      manualReviewFallback,
    };

    await saveRule({
      name: ruleName,
      conditions: JSON.stringify(conditions),
      actions: JSON.stringify(actions),
      active
    });

    // Reset Form
    setRuleName('');
    setCondValue('');
    setAssignee('');
    setConfidenceThreshold(85);
    setAutoDraft(true);
    setAutoSend(false);
    setManualReviewFallback(true);
    setIsFormOpen(false);
  };

  const handleToggleRule = async (rule: any) => {
    await saveRule({
      ...rule,
      active: !rule.active
    });
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this rule?')) {
      await deleteRule(id);
    }
  };

  const formatConditions = (conditionsJson: string) => {
    try {
      const cond = JSON.parse(conditionsJson);
      return cond.rules.map((r: any, idx: number) => (
        <span key={idx}>
          {idx > 0 && <span className="text-accent-text font-bold mx-1">AND</span>}
          <span className="text-text-secondary font-medium">{r.field}</span>{' '}
          <span className="text-text-muted font-mono text-[10px]">{r.operator}</span>{' '}
          <span className="text-accent-text font-semibold">"{r.value}"</span>
        </span>
      ));
    } catch (e) {
      return <span className="text-danger">Malformed conditions</span>;
    }
  };

  const formatActions = (actionsJson: string) => {
    try {
      const act = JSON.parse(actionsJson);
      if (act.actionType === 'ESCALATE') {
        return (
          <span>
            Escalate to <span className="text-danger font-semibold">{act.assignee || 'Jane Doe'}</span> (Priority: URGENT)
          </span>
        );
      }
      const template = templates.find((t) => t.id === act.templateId);
      const actionLabel = act.actionType === 'AUTO_REPLY' ? 'Send Auto-Reply' : 'Draft for approval';
      return (
        <span className="space-y-1.5 block">
          <span>
            {actionLabel} using <span className="text-success font-semibold">{template?.name || 'Policy Template'}</span>
          </span>
          <span className="flex items-center gap-3 text-[10px] text-text-muted font-mono flex-wrap pt-1.5 border-t border-border mt-1.5">
            <span>Confidence Min: <strong className="text-accent-text">{(act.confidenceThreshold * 100).toFixed(0)}%</strong></span>
            <span>Auto-Draft: <strong className="text-accent-text">{act.autoDraft ? 'Yes' : 'No'}</strong></span>
            <span>Auto-Send: <strong className="text-accent-text">{act.autoSend ? 'Yes' : 'No'}</strong></span>
            <span>Review Fallback: <strong className="text-accent-text">{act.manualReviewFallback ? 'Yes' : 'No'}</strong></span>
          </span>
        </span>
      );
    } catch (e) {
      return <span className="text-danger">Malformed actions</span>;
    }
  };

  return (
    <div className="space-y-8 pb-12 text-xs">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-text-primary flex items-center gap-2">
            Automation Rules
          </h1>
          <p className="text-text-secondary text-xs mt-1">
            Build triggers to automatically route, categorize, reply, or escalate incoming messages.
          </p>
        </div>

        {!isFormOpen && (
          <button
            onClick={() => setIsFormOpen(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-accent hover:bg-accent-hover text-xs font-semibold rounded-lg text-white transition-all cursor-pointer shadow-lg shadow-accent/10 hover:shadow-accent/25"
          >
            <Plus className="w-4 h-4" />
            Create Custom Rule
          </button>
        )}
      </div>

      {/* Rules Builder Form */}
      {isFormOpen && (
        <div className="glass-panel p-6 rounded-xl border border-accent-border bg-accent-bg space-y-6">
          <div className="flex justify-between items-center pb-3 border-b border-border">
            <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2">
              <SlidersHorizontal className="w-4 h-4 text-accent-text" />
              Configure New Automation Rule
            </h3>
            <button
              onClick={() => setIsFormOpen(false)}
              className="p-1 hover:bg-surface-3 rounded text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <form onSubmit={handleCreateRule} className="space-y-6">
            {/* Rule Name */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block font-semibold text-text-secondary uppercase tracking-wider mb-2">Rule Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Out of Warranty Rule"
                  value={ruleName}
                  onChange={(e) => setRuleName(e.target.value)}
                  className="w-full bg-surface-3 border border-border rounded-lg px-3 py-2 text-text-primary outline-none focus:border-accent transition-colors"
                />
              </div>
              <div className="flex items-end h-full">
                <button
                  type="button"
                  onClick={() => setActive(!active)}
                  className="flex items-center gap-2 px-3 py-2 bg-surface-2 border border-border hover:border-border-strong rounded-lg transition-colors cursor-pointer text-text-secondary font-semibold"
                >
                  {active ? <ToggleRight className="w-5 h-5 text-success" /> : <ToggleLeft className="w-5 h-5 text-text-muted" />}
                  Rule Active Status
                </button>
              </div>
            </div>

            {/* Condition: IF */}
            <div className="space-y-3">
              <span className="px-2 py-0.5 rounded bg-accent-bg text-[10px] font-bold text-accent-text uppercase tracking-wider">
                IF (Condition)
              </span>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-surface-3 p-4 rounded-xl border border-border">
                <div>
                  <label className="block text-text-muted mb-1.5 font-medium">Field</label>
                  <select
                    value={condField}
                    onChange={(e) => setCondField(e.target.value as any)}
                    className="w-full bg-surface-3 border border-border rounded-lg px-3 py-2 text-text-secondary outline-none focus:border-accent cursor-pointer"
                  >
                    <option value="category">Category</option>
                    <option value="sentiment">Sentiment</option>
                    <option value="priority">Priority</option>
                    <option value="subject">Subject</option>
                    <option value="body">Body Content</option>
                  </select>
                </div>

                <div>
                  <label className="block text-text-muted mb-1.5 font-medium">Operator</label>
                  <select
                    value={condOperator}
                    onChange={(e) => setCondOperator(e.target.value as any)}
                    className="w-full bg-surface-3 border border-border rounded-lg px-3 py-2 text-text-secondary outline-none focus:border-accent cursor-pointer"
                  >
                    <option value="equals">Equals</option>
                    <option value="not_equals">Does Not Equal</option>
                    <option value="contains">Contains (String)</option>
                    <option value="contains_any">Contains Any (Comma separated)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-text-muted mb-1.5 font-medium">Matching Value</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Billing, urgent, double charge"
                    value={condValue}
                    onChange={(e) => setCondValue(e.target.value)}
                    className="w-full bg-surface-3 border border-border rounded-lg px-3 py-2 text-text-primary outline-none focus:border-accent"
                  />
                </div>
              </div>
            </div>

            {/* Action: THEN */}
            <div className="space-y-3">
              <span className="px-2 py-0.5 rounded bg-success-bg text-[10px] font-bold text-success uppercase tracking-wider">
                THEN (Action)
              </span>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-surface-3 p-4 rounded-xl border border-border">
                <div>
                  <label className="block text-text-muted mb-1.5 font-medium">Action Dispatch</label>
                  <select
                    value={actionType}
                    onChange={(e) => setActionType(e.target.value as any)}
                    className="w-full bg-surface-3 border border-border rounded-lg px-3 py-2 text-text-secondary outline-none focus:border-accent cursor-pointer"
                  >
                    <option value="AUTO_REPLY">Send Auto-Reply Immediately</option>
                    <option value="REPLY_TEMPLATE">Draft Auto-Reply & Request Approval</option>
                    <option value="ESCALATE">Escalate to Support Specialist</option>
                  </select>
                </div>

                {actionType !== 'ESCALATE' ? (
                  <>
                    <div>
                      <label className="block text-text-muted mb-1.5 font-medium">Select Template</label>
                      <select
                        value={selectedTemplateId}
                        required
                        onChange={(e) => setSelectedTemplateId(e.target.value)}
                        className="w-full bg-surface-3 border border-border rounded-lg px-3 py-2 text-text-secondary outline-none focus:border-accent cursor-pointer"
                      >
                        <option value="">-- Choose Template --</option>
                        {templates.map((t) => (
                          <option key={t.id} value={t.id}>{t.name}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-text-muted mb-1.5 font-medium">Target Inbox Status</label>
                      <select
                        value={selectedStatus}
                        onChange={(e) => setSelectedStatus(e.target.value)}
                        className="w-full bg-surface-3 border border-border rounded-lg px-3 py-2 text-text-secondary outline-none focus:border-accent cursor-pointer"
                      >
                        <option value="WAITING">WAITING APPROVAL</option>
                        <option value="REPLIED">REPLIED</option>
                        <option value="UNREAD">UNREAD</option>
                      </select>
                    </div>
                  </>
                ) : (
                  <div>
                    <label className="block text-text-muted mb-1.5 font-medium">Assignee Agent Email</label>
                    <input
                      type="email"
                      required
                      placeholder="e.g. jane@stylecraftus.com"
                      value={assignee}
                      onChange={(e) => setAssignee(e.target.value)}
                      className="w-full bg-surface-3 border border-border rounded-lg px-3 py-2 text-text-primary outline-none focus:border-accent"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Confidence & Routing Options */}
            {actionType !== 'ESCALATE' && (
              <div className="space-y-3">
                <span className="px-2 py-0.5 rounded bg-accent-bg text-[10px] font-bold text-accent-text uppercase tracking-wider">
                  Confidence & Routing Tuning
                </span>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-surface-3 p-4 rounded-xl border border-border">
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <label className="font-semibold text-text-secondary uppercase tracking-wider">Confidence Threshold</label>
                      <span className="font-mono text-accent-text font-bold">{confidenceThreshold}%</span>
                    </div>
                    <input
                      type="range"
                      min="10"
                      max="100"
                      value={confidenceThreshold}
                      onChange={(e) => setConfidenceThreshold(parseInt(e.target.value))}
                      className="w-full h-1.5 bg-surface-3 rounded-lg appearance-none cursor-pointer accent-accent"
                    />
                    <span className="text-[10px] text-text-muted block">
                      Minimum AI certainty before this template is matched to create draft responses.
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="autoDraft"
                        checked={autoDraft}
                        onChange={(e) => setAutoDraft(e.target.checked)}
                        className="rounded border-border bg-surface-3 text-accent focus:ring-accent w-4 h-4 cursor-pointer"
                      />
                      <label htmlFor="autoDraft" className="text-text-secondary cursor-pointer">Auto-Draft Enabled</label>
                    </div>

                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="autoSend"
                        checked={autoSend}
                        onChange={(e) => setAutoSend(e.target.checked)}
                        className="rounded border-border bg-surface-3 text-accent focus:ring-accent w-4 h-4 cursor-pointer"
                      />
                      <label htmlFor="autoSend" className="text-text-secondary cursor-pointer">Auto-Send (Disabled Default)</label>
                    </div>

                    <div className="flex items-center gap-2 col-span-2">
                      <input
                        type="checkbox"
                        id="reviewFallback"
                        checked={manualReviewFallback}
                        onChange={(e) => setManualReviewFallback(e.target.checked)}
                        className="rounded border-border bg-surface-3 text-accent focus:ring-accent w-4 h-4 cursor-pointer"
                      />
                      <label htmlFor="reviewFallback" className="text-text-secondary cursor-pointer font-semibold text-accent-text">Manual Review Fallback</label>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Submit */}
            <div className="flex justify-end gap-3 pt-3 border-t border-border">
              <button
                type="button"
                onClick={() => setIsFormOpen(false)}
                className="px-4 py-2 border border-border rounded-lg text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 bg-accent hover:bg-accent-hover rounded-lg text-white font-semibold shadow-lg shadow-accent/10 cursor-pointer"
              >
                Save Automation Rule
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Rules list */}
      <div className="grid grid-cols-1 gap-6">
        {rules.length === 0 ? (
          <div className="glass-panel py-12 rounded-xl text-center border border-border flex flex-col items-center justify-center text-text-muted">
            <Sliders className="w-12 h-12 text-text-muted mb-3 animate-pulse" />
            <h3 className="text-sm font-semibold text-text-secondary">No automation rules configured</h3>
            <p className="text-xs text-text-muted mt-1">Create rules to auto-answer or route incoming emails.</p>
          </div>
        ) : (
          rules.map((rule) => (
            <div key={rule.id} className={`glass-panel p-6 rounded-xl border border-border hover:border-border transition-all ${
              !rule.active ? 'opacity-60' : ''
            }`}>
              <div className="flex justify-between items-start gap-4 mb-4">
                <div>
                  <h3 className="text-sm font-bold text-text-primary flex items-center gap-2">
                    {rule.name}
                    {!rule.active && (
                      <span className="px-1.5 py-0.5 rounded bg-surface-3 border border-border text-[9px] text-text-muted font-medium">
                        Inactive
                      </span>
                    )}
                  </h3>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleToggleRule(rule)}
                    className="p-1 hover:bg-surface-3 rounded text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
                    title={rule.active ? 'Deactivate rule' : 'Activate rule'}
                  >
                    {rule.active ? <ToggleRight className="w-6 h-6 text-success" /> : <ToggleLeft className="w-6 h-6 text-text-muted" />}
                  </button>
                  <button
                    onClick={() => handleDelete(rule.id)}
                    className="p-1.5 hover:bg-surface-3 rounded text-text-secondary hover:text-danger transition-colors cursor-pointer"
                    title="Delete rule"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Conditions & Actions Description */}
              <div className="space-y-2.5 text-xs bg-surface-3 p-4 rounded-lg border border-border">
                <div className="flex items-start gap-2">
                  <span className="px-1.5 py-0.5 rounded bg-accent-bg border border-accent-border text-[9px] font-bold text-accent-text uppercase tracking-wider mt-0.5">
                    IF
                  </span>
                  <div className="text-text-secondary leading-normal">{formatConditions(rule.conditions)}</div>
                </div>
                <div className="flex items-start gap-2">
                  <span className="px-1.5 py-0.5 rounded bg-success-bg border border-success/25 text-[9px] font-bold text-success uppercase tracking-wider mt-0.5">
                    THEN
                  </span>
                  <div className="text-text-secondary leading-normal">{formatActions(rule.actions)}</div>
                </div>
              </div>

              {/* Trigger Stats */}
              {(rule.triggerCount !== undefined && rule.triggerCount > 0) && (
                <div className="mt-3 pt-2 flex gap-4 text-[10px] text-text-muted font-mono">
                  <span>Triggers Count: <strong className="text-accent-text">{rule.triggerCount}</strong></span>
                  {rule.lastTriggeredAt && (
                    <span>Last Triggered: <strong className="text-accent-text">{new Date(rule.lastTriggeredAt).toLocaleString()}</strong></span>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
