/**
 * WebModeBanner — Web 模式提示横幅
 * 仅在浏览器（非 Electron）环境下显示，告知用户当前处于 Web 模式及其限制
 * Session 内关闭后不再显示（使用 sessionStorage）
 */
import { useState } from 'react';
import { Globe, X } from 'lucide-react';
import { isElectron } from '../lib/transport';

export function WebModeBanner() {
  const [dismissed, setDismissed] = useState(
    () => sessionStorage.getItem('web-banner-dismissed') === '1',
  );

  // Electron 环境不显示
  if (isElectron() || dismissed) return null;

  const handleDismiss = () => {
    sessionStorage.setItem('web-banner-dismissed', '1');
    setDismissed(true);
  };

  return (
    <div className="web-mode-banner" role="status">
      <Globe size={13} className="web-mode-banner-icon" />
      <span className="web-mode-banner-text">
        Web 模式 · 已连接 127.0.0.1:5175 · 文件选择对话框不可用，请手动输入路径
      </span>
      <button
        className="web-mode-banner-dismiss"
        onClick={handleDismiss}
        aria-label="关闭提示"
        type="button"
      >
        <X size={12} />
      </button>
    </div>
  );
}
