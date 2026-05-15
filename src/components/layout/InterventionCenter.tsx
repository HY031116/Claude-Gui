import type { AskQuestionRequestEvent, PermissionRequestEvent } from '../../types/electron';
import type { PendingDecisionRequest, PendingFileRequest } from '../../types';

export interface PendingQuestionItem {
  request: AskQuestionRequestEvent;
  tabId?: string;
  tabLabel: string;
}

export interface PendingPermissionItem {
  request: PermissionRequestEvent;
  tabId?: string;
  tabLabel: string;
}

export interface PendingDecisionItem {
  request: PendingDecisionRequest;
  tabId: string;
  tabLabel: string;
}

export interface PendingFileItem {
  request: PendingFileRequest;
  tabId: string;
  tabLabel: string;
}

interface InterventionCenterProps {
  isOpen: boolean;
  pendingQuestions: PendingQuestionItem[];
  pendingPermissions: PendingPermissionItem[];
  pendingDecisions: PendingDecisionItem[];
  pendingFiles: PendingFileItem[];
  activeQuestionId: string | null;
  permissionRespondingId: string | null;
  onClose: () => void;
  onFocusQuestion: (requestId: string, tabId?: string) => void;
  onFocusTab: (tabId?: string) => void;
  onDecisionReply: (tabId: string, text: string) => void;
  onFileSkip: (tabId: string, text: string) => void;
  onApprovePermission: (request: PermissionRequestEvent) => void;
  onDenyPermission: (request: PermissionRequestEvent) => void;
}

export function InterventionCenter({
  isOpen,
  pendingQuestions,
  pendingPermissions,
  pendingDecisions,
  pendingFiles,
  activeQuestionId,
  permissionRespondingId,
  onClose,
  onFocusQuestion,
  onFocusTab,
  onDecisionReply,
  onFileSkip,
  onApprovePermission,
  onDenyPermission,
}: InterventionCenterProps) {
  if (!isOpen) return null;

  const total = pendingQuestions.length + pendingPermissions.length + pendingDecisions.length + pendingFiles.length;

  return (
    <div className="intervention-center-overlay" onClick={onClose}>
      <aside className="intervention-center" onClick={(event) => event.stopPropagation()}>
        <div className="intervention-center-header">
          <div>
            <div className="intervention-center-kicker">v4.2.0 MVP</div>
            <h2 className="intervention-center-title">介入中心</h2>
          </div>
          <button className="intervention-center-close" onClick={onClose} aria-label="关闭介入中心">×</button>
        </div>

        <div className="intervention-center-summary">
          <div className="intervention-center-pill">共 {total} 项待处理</div>
          <div className="intervention-center-pill">提问 {pendingQuestions.length}</div>
          <div className="intervention-center-pill">审批 {pendingPermissions.length}</div>
          <div className="intervention-center-pill">决策 {pendingDecisions.length}</div>
          <div className="intervention-center-pill">文件 {pendingFiles.length}</div>
        </div>

        <div className="intervention-center-sections">
          <section className="intervention-center-section">
            <div className="intervention-center-section-title">Claude 提问</div>
            {pendingQuestions.length === 0 ? (
              <div className="intervention-center-empty">当前没有待处理提问。</div>
            ) : (
              pendingQuestions.map((item) => (
                <article
                  key={item.request.id}
                  className={`intervention-center-card${activeQuestionId === item.request.id ? ' active' : ''}`}
                >
                  <div className="intervention-center-card-top">
                    <span className="intervention-center-card-type">提问</span>
                    <span className="intervention-center-card-tab">{item.tabLabel}</span>
                  </div>
                  <div className="intervention-center-card-title">{item.request.questions[0]?.question ?? '等待你的选择'}</div>
                  <div className="intervention-center-card-meta">
                    {item.request.questions.length === 1 ? '1 个问题' : `${item.request.questions.length} 个问题`}
                    <span>·</span>
                    <span>{item.request.toolName === 'AskUserQuestion' ? 'CLI 原生' : '兼容工具'}</span>
                  </div>
                  <div className="intervention-center-card-actions">
                    <button
                      className="intervention-center-btn intervention-center-btn-primary"
                      onClick={() => onFocusQuestion(item.request.id, item.tabId)}
                    >
                      {activeQuestionId === item.request.id ? '正在处理' : '立即处理'}
                    </button>
                  </div>
                </article>
              ))
            )}
          </section>

          <section className="intervention-center-section">
            <div className="intervention-center-section-title">工具审批</div>
            {pendingPermissions.length === 0 ? (
              <div className="intervention-center-empty">当前没有待处理审批。</div>
            ) : (
              pendingPermissions.map((item) => {
                const preview = (item.request.inputPreview || JSON.stringify(item.request.toolInput)).slice(0, 180);
                const responding = permissionRespondingId === item.request.id;
                return (
                  <article key={item.request.id} className="intervention-center-card intervention-center-card-permission">
                    <div className="intervention-center-card-top">
                      <span className="intervention-center-card-type">审批</span>
                      <span className="intervention-center-card-tab">{item.tabLabel}</span>
                    </div>
                    <div className="intervention-center-card-title">{item.request.toolName}</div>
                    <pre className="intervention-center-preview">{preview}</pre>
                    <div className="intervention-center-card-actions split">
                      <button
                        className="intervention-center-btn intervention-center-btn-success"
                        disabled={responding}
                        onClick={() => onApprovePermission(item.request)}
                      >
                        允许
                      </button>
                      <button
                        className="intervention-center-btn intervention-center-btn-danger"
                        disabled={responding}
                        onClick={() => onDenyPermission(item.request)}
                      >
                        拒绝
                      </button>
                    </div>
                  </article>
                );
              })
            )}
          </section>

          <section className="intervention-center-section">
            <div className="intervention-center-section-title">决策问题</div>
            {pendingDecisions.length === 0 ? (
              <div className="intervention-center-empty">当前没有待处理决策问题。</div>
            ) : (
              pendingDecisions.map((item) => (
                <article key={`decision-${item.tabId}-${item.request.createdAt}`} className="intervention-center-card">
                  <div className="intervention-center-card-top">
                    <span className="intervention-center-card-type">决策</span>
                    <span className="intervention-center-card-tab">{item.tabLabel}</span>
                  </div>
                  <div className="intervention-center-card-title">{item.request.text.slice(0, 120)}</div>
                  {item.request.options.length > 0 && (
                    <div className="intervention-center-option-list">
                      {item.request.options.slice(0, 4).map((option) => (
                        <button
                          key={option}
                          className="intervention-center-option-chip intervention-center-option-chip-action"
                          onClick={() => onDecisionReply(item.tabId, option)}
                        >
                          {option}
                        </button>
                      ))}
                    </div>
                  )}
                  <div className="intervention-center-card-actions">
                    <button
                      className="intervention-center-btn"
                      onClick={() => onDecisionReply(item.tabId, 'Please use your best judgment and proceed.')}
                    >
                      自主决定
                    </button>
                    <button className="intervention-center-btn intervention-center-btn-primary" onClick={() => onFocusTab(item.tabId)}>
                      进入对话处理
                    </button>
                  </div>
                </article>
              ))
            )}
          </section>

          <section className="intervention-center-section">
            <div className="intervention-center-section-title">文件请求</div>
            {pendingFiles.length === 0 ? (
              <div className="intervention-center-empty">当前没有待处理文件请求。</div>
            ) : (
              pendingFiles.map((item) => (
                <article key={`file-${item.tabId}-${item.request.createdAt}`} className="intervention-center-card">
                  <div className="intervention-center-card-top">
                    <span className="intervention-center-card-type">文件</span>
                    <span className="intervention-center-card-tab">{item.tabLabel}</span>
                  </div>
                  <div className="intervention-center-card-title">{item.request.text.slice(0, 120)}</div>
                  <div className="intervention-center-card-actions split">
                    <button
                      className="intervention-center-btn"
                      onClick={() => onFileSkip(item.tabId, 'I cannot provide that. Please continue without it.')}
                    >
                      无需提供继续
                    </button>
                    <button className="intervention-center-btn intervention-center-btn-primary" onClick={() => onFocusTab(item.tabId)}>
                      进入对话处理
                    </button>
                  </div>
                </article>
              ))
            )}
          </section>
        </div>
      </aside>
    </div>
  );
}