'use client';

import { useState, useEffect } from 'react';
import { GlobalTodo } from '@/types';
import { getGlobalTodos, saveGlobalTodos } from '@/lib/storage';

function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2); }

const PRIORITY_STYLE: Record<number, { bg: string; text: string; label: string }> = {
  1: { bg: 'bg-red-100',    text: 'text-red-700',    label: '高' },
  2: { bg: 'bg-yellow-100', text: 'text-yellow-700', label: '中' },
  3: { bg: 'bg-gray-100',   text: 'text-gray-500',   label: '低' },
};

function deadlineColor(deadline: string) {
  if (!deadline) return 'text-gray-400';
  const days = Math.ceil((new Date(deadline).getTime() - new Date().setHours(0,0,0,0)) / 86400000);
  if (days < 0)  return 'text-red-500 font-semibold';
  if (days <= 7) return 'text-orange-500 font-semibold';
  return 'text-gray-500';
}

function daysLabel(deadline: string) {
  if (!deadline) return '';
  const days = Math.ceil((new Date(deadline).getTime() - new Date().setHours(0,0,0,0)) / 86400000);
  if (days < 0)  return `（逾期 ${-days} 天）`;
  if (days === 0) return '（今天）';
  if (days === 1) return '（明天）';
  return `（${days} 天後）`;
}

const EMPTY_DRAFT = { title: '', currentStatus: '', nextAction: '', deadline: '', stakeholder: '', priority: 2 as 1|2|3 };

export default function GlobalTodosPanel() {
  const [todos, setTodos] = useState<GlobalTodo[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  const [sortBy, setSortBy] = useState<'deadline' | 'priority'>('deadline');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState(EMPTY_DRAFT);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => { setTodos(getGlobalTodos()); }, []);

  const sorted = [...todos].sort((a, b) => {
    if (sortBy === 'priority') {
      if (a.priority !== b.priority) return a.priority - b.priority;
      return (a.deadline || '9999') < (b.deadline || '9999') ? -1 : 1;
    }
    const da = a.deadline || '9999-99-99';
    const db = b.deadline || '9999-99-99';
    if (da !== db) return da < db ? -1 : 1;
    return a.priority - b.priority;
  });

  const add = () => {
    if (!draft.title.trim()) { alert('請填寫事項內容'); return; }
    const item: GlobalTodo = { id: uid(), ...draft, createdAt: new Date().toISOString() };
    const updated = [...todos, item];
    setTodos(updated);
    saveGlobalTodos(updated);
    setDraft(EMPTY_DRAFT);
    setShowForm(false);
  };

  const remove = (id: string) => {
    const updated = todos.filter(t => t.id !== id);
    setTodos(updated);
    saveGlobalTodos(updated);
  };

  const startEdit = (t: GlobalTodo) => {
    setEditingId(t.id);
    setEditDraft({ title: t.title, currentStatus: t.currentStatus, nextAction: t.nextAction, deadline: t.deadline, stakeholder: t.stakeholder, priority: t.priority });
  };

  const saveEdit = () => {
    if (!editingId) return;
    const updated = todos.map(t => t.id === editingId ? { ...t, ...editDraft } : t);
    setTodos(updated);
    saveGlobalTodos(updated);
    setEditingId(null);
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-6">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 cursor-pointer select-none" onClick={() => setCollapsed(v => !v)}>
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-semibold text-gray-700">待辦事項</h2>
          {todos.length > 0 && (
            <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{todos.length}</span>
          )}
        </div>
        <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
          {!collapsed && (
            <>
              <button
                onClick={() => setSortBy('deadline')}
                className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${sortBy === 'deadline' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white border-gray-200 text-gray-500 hover:border-blue-400'}`}
              >
                截止日排序
              </button>
              <button
                onClick={() => setSortBy('priority')}
                className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${sortBy === 'priority' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white border-gray-200 text-gray-500 hover:border-blue-400'}`}
              >
                重要性排序
              </button>
              <button
                onClick={() => { setShowForm(v => !v); setEditingId(null); }}
                className="text-xs px-3 py-1 bg-blue-600 text-white rounded-full hover:bg-blue-700"
              >
                ＋ 新增
              </button>
            </>
          )}
          <span className="text-gray-400 text-xs ml-1">{collapsed ? '▼' : '▲'}</span>
        </div>
      </div>

      {!collapsed && (
        <div className="p-4 space-y-3">
          {/* 新增表單 */}
          {showForm && (
            <div className="p-4 bg-blue-50 rounded-xl border border-blue-100 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="text-xs text-gray-500">事項內容</label>
                  <input value={draft.title} onChange={e => setDraft(d => ({ ...d, title: e.target.value }))}
                    placeholder="要做什麼..."
                    className="block mt-1 px-3 py-1.5 border border-gray-200 rounded-lg text-sm text-gray-800 w-full bg-white focus:outline-none focus:border-blue-400" />
                </div>
                <div>
                  <label className="text-xs text-gray-500">截止日期</label>
                  <input type="date" value={draft.deadline} onChange={e => setDraft(d => ({ ...d, deadline: e.target.value }))}
                    className="block mt-1 px-3 py-1.5 border border-gray-200 rounded-lg text-sm text-gray-800 w-full bg-white focus:outline-none" />
                </div>
                <div>
                  <label className="text-xs text-gray-500">Stakeholder（關係人）</label>
                  <input value={draft.stakeholder} onChange={e => setDraft(d => ({ ...d, stakeholder: e.target.value }))}
                    placeholder="相關人員..."
                    className="block mt-1 px-3 py-1.5 border border-gray-200 rounded-lg text-sm text-gray-800 w-full bg-white focus:outline-none" />
                </div>
                <div>
                  <label className="text-xs text-gray-500">重要性（Priority）</label>
                  <div className="flex gap-2 mt-1">
                    {([1, 2, 3] as const).map(p => (
                      <button key={p} onClick={() => setDraft(d => ({ ...d, priority: p }))}
                        className={`flex-1 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                          draft.priority === p ? `${PRIORITY_STYLE[p].bg} ${PRIORITY_STYLE[p].text} border-transparent` : 'bg-white border-gray-200 text-gray-400 hover:border-gray-400'
                        }`}>
                        {PRIORITY_STYLE[p].label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-xs text-gray-500">Current Status</label>
                  <textarea value={draft.currentStatus} onChange={e => setDraft(d => ({ ...d, currentStatus: e.target.value }))}
                    placeholder="目前狀態..." rows={2}
                    className="block mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-800 w-full bg-white focus:outline-none resize-none" />
                </div>
                <div>
                  <label className="text-xs text-gray-500">Next Action</label>
                  <textarea value={draft.nextAction} onChange={e => setDraft(d => ({ ...d, nextAction: e.target.value }))}
                    placeholder="下一步..." rows={2}
                    className="block mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-800 w-full bg-white focus:outline-none resize-none" />
                </div>
              </div>
              <div className="flex gap-2 pt-1">
                <button onClick={add} className="flex-1 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">新增</button>
                <button onClick={() => setShowForm(false)} className="px-4 py-2 border border-gray-200 text-sm rounded-lg text-gray-500 hover:border-gray-400">取消</button>
              </div>
            </div>
          )}

          {/* 清單 */}
          {sorted.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">尚無待辦事項</p>
          ) : (
            <div className="grid grid-cols-2 gap-3">
            {sorted.map(t => {
              const p = PRIORITY_STYLE[t.priority];
              const isEditing = editingId === t.id;
              return (
                <div key={t.id} className={`border rounded-xl p-4 ${isEditing ? 'border-blue-300 bg-blue-50 col-span-2' : 'border-gray-100 hover:border-gray-200'}`}>
                  {isEditing ? (
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="col-span-2">
                          <label className="text-xs text-gray-500">事項內容</label>
                          <input value={editDraft.title} onChange={e => setEditDraft(d => ({ ...d, title: e.target.value }))}
                            className="block mt-1 px-3 py-1.5 border border-gray-200 rounded-lg text-sm text-gray-800 w-full bg-white focus:outline-none focus:border-blue-400" />
                        </div>
                        <div>
                          <label className="text-xs text-gray-500">截止日期</label>
                          <input type="date" value={editDraft.deadline} onChange={e => setEditDraft(d => ({ ...d, deadline: e.target.value }))}
                            className="block mt-1 px-3 py-1.5 border border-gray-200 rounded-lg text-sm text-gray-800 w-full bg-white focus:outline-none" />
                        </div>
                        <div>
                          <label className="text-xs text-gray-500">Stakeholder</label>
                          <input value={editDraft.stakeholder} onChange={e => setEditDraft(d => ({ ...d, stakeholder: e.target.value }))}
                            className="block mt-1 px-3 py-1.5 border border-gray-200 rounded-lg text-sm text-gray-800 w-full bg-white focus:outline-none" />
                        </div>
                        <div>
                          <label className="text-xs text-gray-500">重要性</label>
                          <div className="flex gap-2 mt-1">
                            {([1, 2, 3] as const).map(p => (
                              <button key={p} onClick={() => setEditDraft(d => ({ ...d, priority: p }))}
                                className={`flex-1 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                                  editDraft.priority === p ? `${PRIORITY_STYLE[p].bg} ${PRIORITY_STYLE[p].text} border-transparent` : 'bg-white border-gray-200 text-gray-400 hover:border-gray-400'
                                }`}>
                                {PRIORITY_STYLE[p].label}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div>
                          <label className="text-xs text-gray-500">Current Status</label>
                          <textarea value={editDraft.currentStatus} onChange={e => setEditDraft(d => ({ ...d, currentStatus: e.target.value }))}
                            rows={2} className="block mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-800 w-full bg-white focus:outline-none resize-none" />
                        </div>
                        <div>
                          <label className="text-xs text-gray-500">Next Action</label>
                          <textarea value={editDraft.nextAction} onChange={e => setEditDraft(d => ({ ...d, nextAction: e.target.value }))}
                            rows={2} className="block mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-800 w-full bg-white focus:outline-none resize-none" />
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={saveEdit} className="flex-1 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">儲存</button>
                        <button onClick={() => setEditingId(null)} className="px-4 py-1.5 border border-gray-200 text-sm rounded-lg text-gray-500 hover:border-gray-400">取消</button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div className="flex items-center gap-2 flex-wrap min-w-0">
                          <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full shrink-0 ${p.bg} ${p.text}`}>
                            {p.label}
                          </span>
                          <span className="text-sm font-semibold text-gray-800">{t.title}</span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <button onClick={() => startEdit(t)} className="text-xs text-gray-400 hover:text-blue-500">編輯</button>
                          <button onClick={() => remove(t.id)} className="text-xs text-gray-300 hover:text-red-400">✕</button>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500 mb-2">
                        {t.deadline && (
                          <span className={deadlineColor(t.deadline)}>
                            📅 {t.deadline}{daysLabel(t.deadline)}
                          </span>
                        )}
                        {t.stakeholder && <span>👤 {t.stakeholder}</span>}
                      </div>
                      {t.currentStatus && (
                        <div className="mt-1.5">
                          <span className="text-[10px] text-gray-400 uppercase tracking-wide">Current Status</span>
                          <p className="text-sm text-gray-700 mt-0.5 whitespace-pre-wrap">{t.currentStatus}</p>
                        </div>
                      )}
                      {t.nextAction && (
                        <div className="mt-1.5">
                          <span className="text-[10px] text-gray-400 uppercase tracking-wide">Next Action</span>
                          <p className="text-sm text-blue-600 mt-0.5">→ {t.nextAction}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
