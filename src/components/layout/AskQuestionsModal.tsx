import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, X } from 'lucide-react';
import type { AskQuestionAnswer, AskQuestionRequestEvent } from '../../types/electron';

interface AskQuestionsModalProps {
  request: AskQuestionRequestEvent;
  pendingCount: number;
  submitting: boolean;
  onSubmit: (answers: Record<string, AskQuestionAnswer>) => void;
  onSkip: () => void;
}

type DraftAnswers = Record<string, { selected: string[]; freeText: string }>;

function buildInitialDraft(request: AskQuestionRequestEvent): DraftAnswers {
  const draft: DraftAnswers = {};
  for (const question of request.questions) {
    draft[question.header] = { selected: [], freeText: '' };
  }
  return draft;
}

export function AskQuestionsModal({ request, pendingCount, submitting, onSubmit, onSkip }: AskQuestionsModalProps) {
  const [draft, setDraft] = useState<DraftAnswers>(() => buildInitialDraft(request));

  useEffect(() => {
    setDraft(buildInitialDraft(request));
  }, [request]);

  const answers = useMemo(() => {
    const next: Record<string, AskQuestionAnswer> = {};
    for (const question of request.questions) {
      const current = draft[question.header] ?? { selected: [], freeText: '' };
      const freeText = current.freeText.trim();
      const selected = current.selected;
      next[question.header] = {
        selected,
        freeText,
        skipped: selected.length === 0 && freeText.length === 0,
      };
    }
    return next;
  }, [draft, request.questions]);

  return (
    <div className="askq-modal-overlay" role="dialog" aria-modal="true">
      <div className="askq-modal" onClick={(event) => event.stopPropagation()}>
        <div className="askq-modal-header">
          <div>
            <div className="askq-modal-kicker">{request.toolName === 'AskUserQuestion' ? 'Claude CLI 原生提问' : 'Claude Code 提问'}</div>
            <h2 className="askq-modal-title">需要你的选择</h2>
          </div>
          <button className="askq-modal-close" onClick={onSkip} disabled={submitting} aria-label="跳过问题">
            <X size={16} />
          </button>
        </div>

        <div className="askq-modal-body">
          {request.questions.map((question) => {
            const current = draft[question.header] ?? { selected: [], freeText: '' };
            const canFreeInput = question.allowFreeformInput !== false;
            return (
              <section key={question.header} className="askq-question-card">
                <div className="askq-question-header">
                  <div className="askq-question-header-main">
                    <div className="askq-question-label">{question.header}</div>
                    <div className="askq-question-text">{question.question}</div>
                  </div>
                  {question.multiSelect && <span className="askq-question-badge">可多选</span>}
                </div>

                {question.message && <p className="askq-question-message">{question.message}</p>}

                {question.options && question.options.length > 0 && (
                  <div className="askq-option-list">
                    {question.options.map((option) => {
                      const selected = current.selected.includes(option.label);
                      return (
                        <button
                          key={option.label}
                          type="button"
                          className={`askq-option${selected ? ' active' : ''}`}
                          onClick={() => {
                            setDraft((prev) => {
                              const prevQuestion = prev[question.header] ?? { selected: [], freeText: '' };
                              const nextSelected = question.multiSelect
                                ? (selected
                                  ? prevQuestion.selected.filter((item) => item !== option.label)
                                  : [...prevQuestion.selected, option.label])
                                : (selected ? [] : [option.label]);
                              return {
                                ...prev,
                                [question.header]: {
                                  ...prevQuestion,
                                  selected: nextSelected,
                                },
                              };
                            });
                          }}
                        >
                          <span className="askq-option-main">
                            <span className="askq-option-label">{option.label}</span>
                            {option.description && <span className="askq-option-desc">{option.description}</span>}
                          </span>
                          {option.recommended && <span className="askq-option-recommended">推荐</span>}
                          {selected && <CheckCircle2 size={15} className="askq-option-check" />}
                        </button>
                      );
                    })}
                  </div>
                )}

                {canFreeInput && (
                  <div className="askq-freeform-block">
                    <label className="askq-freeform-label">补充说明</label>
                    <textarea
                      className="askq-freeform-input"
                      rows={question.options?.length ? 3 : 4}
                      placeholder="可选，输入补充回答…"
                      value={current.freeText}
                      onChange={(event) => {
                        const value = event.target.value;
                        setDraft((prev) => ({
                          ...prev,
                          [question.header]: {
                            ...(prev[question.header] ?? { selected: [], freeText: '' }),
                            freeText: value,
                          },
                        }));
                      }}
                    />
                  </div>
                )}
              </section>
            );
          })}
        </div>

        <div className="askq-modal-footer">
          <div className="askq-modal-queue">{pendingCount > 1 ? `队列中还有 ${pendingCount - 1} 个问题请求` : '回答后将继续 Claude 当前流程'}</div>
          <div className="askq-modal-actions">
            <button className="askq-btn askq-btn-secondary" onClick={onSkip} disabled={submitting}>跳过</button>
            <button className="askq-btn askq-btn-primary" onClick={() => onSubmit(answers)} disabled={submitting}>提交回答</button>
          </div>
        </div>
      </div>
    </div>
  );
}