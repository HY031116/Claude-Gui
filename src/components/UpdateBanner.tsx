/**
 * UpdateBanner — 应用自动更新浮动通知
 * 订阅 app:updateStatus IPC 事件，根据状态显示可操作的横幅
 * 不干扰主布局，fixed 定位在顶部中央
 */
import { useState, useEffect, useCallback } from 'react';
import { Download, RefreshCw, X, CheckCircle } from 'lucide-react';
import type { UpdateStatus } from '../types/electron';

export function UpdateBanner() {
  const [status, setStatus] = useState<UpdateStatus | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!window.electronAPI?.onUpdateStatus) return;
    const unsub = window.electronAPI.onUpdateStatus((s) => {
      // 仅在有实质内容时显示（不显示 checking/not-available）
      if (s.type === 'available' || s.type === 'downloading' || s.type === 'downloaded' || s.type === 'error') {
        setStatus(s);
        setDismissed(false);
      }
    });
    return unsub;
  }, []);

  const handleDownload = useCallback(() => {
    window.electronAPI?.downloadUpdate?.().catch(() => {});
  }, []);

  const handleInstall = useCallback(() => {
    window.electronAPI?.installUpdate?.();
  }, []);

  const handleDismiss = useCallback(() => setDismissed(true), []);

  if (!status || dismissed) return null;

  return (
    <div className="update-banner" role="alert">
      {status.type === 'available' && (
        <>
          <Download size={14} className="update-banner-icon" />
          <span className="update-banner-text">
            发现新版本 <strong>v{status.version}</strong>，点击下载
          </span>
          <button className="update-banner-btn primary" onClick={handleDownload}>下载</button>
          <button className="update-banner-dismiss" onClick={handleDismiss} aria-label="关闭"><X size={12} /></button>
        </>
      )}
      {status.type === 'downloading' && (
        <>
          <RefreshCw size={14} className="update-banner-icon spinning" />
          <span className="update-banner-text">
            下载更新中… <strong>{status.percent}%</strong>
          </span>
          <div className="update-banner-progress">
            <div className="update-banner-progress-bar" style={{ width: `${status.percent}%` }} />
          </div>
        </>
      )}
      {status.type === 'downloaded' && (
        <>
          <CheckCircle size={14} className="update-banner-icon success" />
          <span className="update-banner-text">
            <strong>v{status.version}</strong> 已下载，重启后生效
          </span>
          <button className="update-banner-btn primary" onClick={handleInstall}>立即重启安装</button>
          <button className="update-banner-dismiss" onClick={handleDismiss} aria-label="关闭"><X size={12} /></button>
        </>
      )}
      {status.type === 'error' && (
        <>
          <span className="update-banner-text error">更新检查失败：{status.message.slice(0, 60)}</span>
          <button className="update-banner-dismiss" onClick={handleDismiss} aria-label="关闭"><X size={12} /></button>
        </>
      )}
    </div>
  );
}
