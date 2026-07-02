import React, { useState, useEffect, useMemo } from 'react';
import { Plus, Pencil, Trash2, X, Save, HelpCircle, Search, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import {
  db,
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  where,
  orderBy,
  LOCATION_ID,
  handleFirestoreError,
  OperationType,
} from '../firebase';
import { toast } from 'sonner';

export type QuizQuestionType = 'Food' | 'Beverage';

export interface QuizTemplate {
  id: string;
  question: string;
  options: string[]; // exactly 4
  correctIndex: number; // 0-3
  explanation?: string;
  type: QuizQuestionType;
  subCategory?: string;
  isActive: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  locationId: string;
}

interface QuizBankManagerProps {
  staffName?: string;
}

const emptyDraft = (): Omit<QuizTemplate, 'id' | 'createdAt' | 'updatedAt' | 'locationId' | 'createdBy'> => ({
  question: '',
  options: ['', '', '', ''],
  correctIndex: 0,
  explanation: '',
  type: 'Food',
  subCategory: '',
  isActive: true,
});

export const QuizBankManager: React.FC<QuizBankManagerProps> = ({ staffName }) => {
  const [templates, setTemplates] = useState<QuizTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<'All' | QuizQuestionType>('All');
  const [searchTerm, setSearchTerm] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [draft, setDraft] = useState(emptyDraft());
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const q = query(
      collection(db, 'quizTemplates'),
      where('locationId', '==', LOCATION_ID),
      orderBy('createdAt', 'desc')
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        const items = snap.docs.map((d) => ({ id: d.id, ...d.data() } as QuizTemplate));
        setTemplates(items);
        setLoading(false);
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, 'quizTemplates');
        setLoading(false);
      }
    );
    return () => unsub();
  }, []);

  const subCategories = useMemo(() => {
    const set = new Set<string>();
    templates.forEach((t) => {
      if (t.subCategory) set.add(t.subCategory);
    });
    return Array.from(set).sort();
  }, [templates]);

  const filteredTemplates = useMemo(() => {
    return templates.filter((t) => {
      if (filterType !== 'All' && t.type !== filterType) return false;
      if (searchTerm.trim()) {
        const s = searchTerm.toLowerCase();
        return (
          t.question.toLowerCase().includes(s) ||
          (t.subCategory || '').toLowerCase().includes(s)
        );
      }
      return true;
    });
  }, [templates, filterType, searchTerm]);

  const startCreate = () => {
    setDraft(emptyDraft());
    setIsCreating(true);
    setEditingId(null);
  };

  const startEdit = (t: QuizTemplate) => {
    setDraft({
      question: t.question,
      options: [...t.options],
      correctIndex: t.correctIndex,
      explanation: t.explanation || '',
      type: t.type,
      subCategory: t.subCategory || '',
      isActive: t.isActive,
    });
    setEditingId(t.id);
    setIsCreating(false);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setIsCreating(false);
    setDraft(emptyDraft());
  };

  const validateDraft = (): string | null => {
    if (!draft.question.trim()) return 'Question text is required.';
    if (draft.options.some((o) => !o.trim())) return 'All 4 options must be filled in.';
    if (draft.correctIndex < 0 || draft.correctIndex > 3) return 'Select a correct answer.';
    return null;
  };

  const saveDraft = async () => {
    const validationError = validateDraft();
    if (validationError) {
      toast.error(validationError);
      return;
    }
    setSaving(true);
    try {
      const now = new Date().toISOString();
      if (editingId) {
        await updateDoc(doc(db, 'quizTemplates', editingId), {
          question: draft.question.trim(),
          options: draft.options.map((o) => o.trim()),
          correctIndex: draft.correctIndex,
          explanation: draft.explanation?.trim() || '',
          type: draft.type,
          subCategory: draft.subCategory?.trim() || '',
          isActive: draft.isActive,
          updatedAt: now,
        });
        toast.success('Question updated.');
      } else {
        const newDoc: Omit<QuizTemplate, 'id'> = {
          question: draft.question.trim(),
          options: draft.options.map((o) => o.trim()),
          correctIndex: draft.correctIndex,
          explanation: draft.explanation?.trim() || '',
          type: draft.type,
          subCategory: draft.subCategory?.trim() || '',
          isActive: draft.isActive,
          createdBy: staffName || 'Unknown',
          createdAt: now,
          updatedAt: now,
          locationId: LOCATION_ID,
        };
        await addDoc(collection(db, 'quizTemplates'), newDoc);
        toast.success('Question added to bank.');
      }
      cancelEdit();
    } catch (err) {
      handleFirestoreError(err, editingId ? OperationType.UPDATE : OperationType.CREATE, 'quizTemplates');
      toast.error('Failed to save question.');
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'quizTemplates', id));
      toast.success('Question deleted.');
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, 'quizTemplates');
      toast.error('Failed to delete question.');
    } finally {
      setConfirmDeleteId(null);
    }
  };

  const toggleActive = async (t: QuizTemplate) => {
    try {
      await updateDoc(doc(db, 'quizTemplates', t.id), {
        isActive: !t.isActive,
        updatedAt: new Date().toISOString(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, 'quizTemplates');
      toast.error('Failed to update status.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-white dark:bg-slate-900 p-4 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-800">
        <div className="relative w-full md:w-96 group">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search questions..."
            className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
          />
        </div>

        <div className="flex items-center gap-2">
          <div className="flex bg-gray-50 dark:bg-slate-800 rounded-xl p-1 border border-gray-200 dark:border-slate-700">
            {(['All', 'Food', 'Beverage'] as const).map((opt) => (
              <button
                key={opt}
                onClick={() => setFilterType(opt)}
                className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
                  filterType === opt
                    ? 'bg-white dark:bg-slate-900 text-accent shadow-sm'
                    : 'text-gray-500 dark:text-slate-400'
                }`}
              >
                {opt}
              </button>
            ))}
          </div>

          <button
            onClick={startCreate}
            className="flex items-center gap-2 bg-accent text-white px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-accent/90 transition-all shadow-sm"
          >
            <Plus className="h-4 w-4" /> New Question
          </button>
        </div>
      </div>

      {(isCreating || editingId) && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-slate-800 shadow-sm p-6 space-y-5"
        >
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-black uppercase tracking-widest text-text-navy dark:text-white">
              {editingId ? 'Edit Question' : 'New Question'}
            </h3>
            <button onClick={cancelEdit} className="text-gray-400 hover:text-gray-600">
              <X className="h-5 w-5" />
            </button>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-gray-500 dark:text-slate-400 uppercase tracking-widest mb-1.5">
              Question
            </label>
            <textarea
              value={draft.question}
              onChange={(e) => setDraft({ ...draft, question: e.target.value })}
              rows={2}
              className="w-full px-3 py-2.5 rounded-xl bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
              placeholder="e.g. What allergen is present in the Mole Poblano?"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {draft.options.map((opt, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setDraft({ ...draft, correctIndex: idx })}
                  title="Mark as correct answer"
                  className={`flex-shrink-0 h-9 w-9 rounded-lg flex items-center justify-center border transition-all ${
                    draft.correctIndex === idx
                      ? 'bg-success/10 border-success text-success'
                      : 'bg-gray-50 dark:bg-slate-800 border-gray-200 dark:border-slate-700 text-gray-300'
                  }`}
                >
                  <CheckCircle2 className="h-4 w-4" />
                </button>
                <input
                  type="text"
                  value={opt}
                  onChange={(e) => {
                    const newOpts = [...draft.options];
                    newOpts[idx] = e.target.value;
                    setDraft({ ...draft, options: newOpts });
                  }}
                  placeholder={`Option ${idx + 1}`}
                  className="flex-1 px-3 py-2 rounded-xl bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
                />
              </div>
            ))}
          </div>
          <p className="text-[10px] text-gray-400 -mt-2">Tap the circle next to the correct option.</p>

          <div>
            <label className="block text-[10px] font-bold text-gray-500 dark:text-slate-400 uppercase tracking-widest mb-1.5">
              Explanation (optional)
            </label>
            <input
              type="text"
              value={draft.explanation}
              onChange={(e) => setDraft({ ...draft, explanation: e.target.value })}
              placeholder="Shown to staff after answering"
              className="w-full px-3 py-2.5 rounded-xl bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-bold text-gray-500 dark:text-slate-400 uppercase tracking-widest mb-1.5">
                Type
              </label>
              <div className="flex bg-gray-50 dark:bg-slate-800 rounded-xl p-1 border border-gray-200 dark:border-slate-700">
                {(['Food', 'Beverage'] as const).map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => setDraft({ ...draft, type: opt })}
                    className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
                      draft.type === opt
                        ? 'bg-white dark:bg-slate-900 text-accent shadow-sm'
                        : 'text-gray-500 dark:text-slate-400'
                    }`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-gray-500 dark:text-slate-400 uppercase tracking-widest mb-1.5">
                Subcategory (optional)
              </label>
              <input
                type="text"
                value={draft.subCategory}
                onChange={(e) => setDraft({ ...draft, subCategory: e.target.value })}
                placeholder="e.g. Tacos, Cocktails, Mezcal"
                list="quizbank-subcategories"
                className="w-full px-3 py-2.5 rounded-xl bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
              />
              <datalist id="quizbank-subcategories">
                {subCategories.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </div>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-gray-100 dark:border-slate-800">
            <label className="flex items-center gap-2 text-xs font-bold text-gray-600 dark:text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={draft.isActive}
                onChange={(e) => setDraft({ ...draft, isActive: e.target.checked })}
                className="rounded"
              />
              Active (available to POS)
            </label>

            <div className="flex gap-2">
              <button
                onClick={cancelEdit}
                className="px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-800 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={saveDraft}
                disabled={saving}
                className="flex items-center gap-2 bg-accent text-white px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-accent/90 transition-all shadow-sm disabled:opacity-50"
              >
                <Save className="h-4 w-4" /> {saving ? 'Saving...' : 'Save Question'}
              </button>
            </div>
          </div>
        </motion.div>
      )}

      {loading ? (
        <div className="text-center py-16 text-gray-400 text-sm">Loading quiz bank...</div>
      ) : filteredTemplates.length === 0 ? (
        <div className="text-center py-16 bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-slate-800">
          <HelpCircle className="h-10 w-10 text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-gray-400">
            {templates.length === 0
              ? 'No quiz questions yet. Add your first one above.'
              : 'No questions match your filters.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredTemplates.map((t) => (
            <div
              key={t.id}
              className={`bg-white dark:bg-slate-900 rounded-2xl border p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all ${
                t.isActive
                  ? 'border-gray-100 dark:border-slate-800'
                  : 'border-gray-100 dark:border-slate-800 opacity-50'
              }`}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                  <span
                    className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded ${
                      t.type === 'Food' ? 'bg-warning/10 text-warning' : 'bg-accent/10 text-accent'
                    }`}
                  >
                    {t.type}
                  </span>
                  {t.subCategory && (
                    <span className="text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-slate-400">
                      {t.subCategory}
                    </span>
                  )}
                  {!t.isActive && (
                    <span className="text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded bg-gray-100 dark:bg-slate-800 text-gray-400">
                      Inactive
                    </span>
                  )}
                </div>
                <p className="text-sm font-bold text-text-navy dark:text-white truncate">{t.question}</p>
                <p className="text-xs text-gray-400 mt-0.5 truncate">
                  Correct: {t.options[t.correctIndex]}
                </p>
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={() => toggleActive(t)}
                  className="px-3 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-800 transition-all"
                >
                  {t.isActive ? 'Deactivate' : 'Activate'}
                </button>
                <button
                  onClick={() => startEdit(t)}
                  className="p-2 rounded-lg text-gray-400 hover:text-accent hover:bg-accent/10 transition-all"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setConfirmDeleteId(t.id)}
                  className="p-2 rounded-lg text-gray-400 hover:text-error hover:bg-error/10 transition-all"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <AnimatePresence>
        {confirmDeleteId && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[120] bg-black/60 flex items-center justify-center p-4"
            onClick={() => setConfirmDeleteId(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white dark:bg-slate-900 rounded-2xl p-6 max-w-sm w-full shadow-2xl"
            >
              <h3 className="text-sm font-black uppercase tracking-widest text-text-navy dark:text-white mb-2">
                Delete this question?
              </h3>
              <p className="text-xs text-gray-400 mb-6">This cannot be undone. It will no longer appear in POS quizzes.</p>
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setConfirmDeleteId(null)}
                  className="px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  onClick={() => confirmDelete(confirmDeleteId)}
                  className="px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest bg-error text-white hover:bg-error/90"
                >
                  Delete
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
