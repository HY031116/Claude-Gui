/**
 * AppearanceTab — 外观设置标签页
 * 提供：深色/浅色主题切换 + 6 种强调色预设 + 字体大小调节
 */
import { Sun, Moon, Check } from 'lucide-react';
import { useAppStore } from '../../stores/useAppStore';

// 强调色配置
const ACCENT_COLORS: Array<{
  id: 'purple' | 'blue' | 'emerald' | 'orange' | 'pink' | 'cyan';
  label: string;
  hex: string;
}> = [
  { id: 'purple',  label: '紫色',   hex: '#7c3aed' },
  { id: 'blue',    label: '蓝色',   hex: '#2563eb' },
  { id: 'emerald', label: '翠绿',   hex: '#059669' },
  { id: 'orange',  label: '橙色',   hex: '#ea580c' },
  { id: 'pink',    label: '粉色',   hex: '#db2777' },
  { id: 'cyan',    label: '青色',   hex: '#0891b2' },
];

// 字体大小配置
const FONT_SIZES: Array<{
  id: 'compact' | 'normal' | 'relaxed';
  label: string;
  desc: string;
  preview: string;
}> = [
  { id: 'compact', label: '紧凑',  desc: '12px 基准', preview: 'Aa' },
  { id: 'normal',  label: '标准',  desc: '14px 基准', preview: 'Aa' },
  { id: 'relaxed', label: '宽松',  desc: '15px 基准', preview: 'Aa' },
];

export function AppearanceTab() {
  const theme       = useAppStore((s) => s.theme);
  const setTheme    = useAppStore((s) => s.setTheme);
  const accentColor = useAppStore((s) => s.accentColor);
  const setAccentColor = useAppStore((s) => s.setAccentColor);
  const fontSize    = useAppStore((s) => s.fontSize);
  const setFontSize = useAppStore((s) => s.setFontSize);

  return (
    <div className="settings-tab-content">
      {/* ── 主题 ── */}
      <section className="appearance-section">
        <div className="appearance-section-title">颜色主题</div>
        <div className="appearance-theme-row">
          <button
            className={`appearance-theme-btn${theme === 'dark' ? ' active' : ''}`}
            onClick={() => setTheme('dark')}
          >
            <div className="appearance-theme-preview appearance-theme-dark">
              <div className="atp-bar" />
              <div className="atp-content">
                <div className="atp-line" />
                <div className="atp-line atp-line--short" />
              </div>
            </div>
            <div className="appearance-theme-label">
              <Moon size={12} />
              深色
              {theme === 'dark' && <Check size={11} className="appearance-check" />}
            </div>
          </button>

          <button
            className={`appearance-theme-btn${theme === 'light' ? ' active' : ''}`}
            onClick={() => setTheme('light')}
          >
            <div className="appearance-theme-preview appearance-theme-light">
              <div className="atp-bar" />
              <div className="atp-content">
                <div className="atp-line" />
                <div className="atp-line atp-line--short" />
              </div>
            </div>
            <div className="appearance-theme-label">
              <Sun size={12} />
              浅色
              {theme === 'light' && <Check size={11} className="appearance-check" />}
            </div>
          </button>
        </div>
      </section>

      {/* ── 强调色 ── */}
      <section className="appearance-section">
        <div className="appearance-section-title">强调色</div>
        <div className="appearance-accent-grid">
          {ACCENT_COLORS.map((c) => (
            <button
              key={c.id}
              className={`appearance-accent-swatch${accentColor === c.id ? ' active' : ''}`}
              style={{ '--swatch-color': c.hex } as React.CSSProperties}
              onClick={() => setAccentColor(c.id)}
              title={c.label}
              aria-label={c.label}
            >
              {accentColor === c.id && <Check size={12} />}
            </button>
          ))}
        </div>
        <div className="appearance-accent-label">
          当前：<span style={{ color: ACCENT_COLORS.find((c) => c.id === accentColor)?.hex }}>
            {ACCENT_COLORS.find((c) => c.id === accentColor)?.label}
          </span>
        </div>
      </section>

      {/* ── 字体大小 ── */}
      <section className="appearance-section">
        <div className="appearance-section-title">界面字号</div>
        <div className="appearance-fontsize-row">
          {FONT_SIZES.map((f) => (
            <button
              key={f.id}
              className={`appearance-fontsize-btn${fontSize === f.id ? ' active' : ''}`}
              onClick={() => setFontSize(f.id)}
            >
              <span
                className="appearance-fontsize-preview"
                style={{
                  fontSize: f.id === 'compact' ? '12px' : f.id === 'normal' ? '15px' : '18px',
                }}
              >
                {f.preview}
              </span>
              <span className="appearance-fontsize-name">{f.label}</span>
              <span className="appearance-fontsize-desc">{f.desc}</span>
              {fontSize === f.id && <Check size={10} className="appearance-check" />}
            </button>
          ))}
        </div>
      </section>

      {/* ── 效果预览 ── */}
      <section className="appearance-section">
        <div className="appearance-section-title">预览</div>
        <div className="appearance-preview-card">
          <div className="appearance-preview-header">
            <div className="appearance-preview-dot" />
            <span>Claude Code GUI</span>
          </div>
          <div className="appearance-preview-body">
            <div className="appearance-preview-tag" style={{ background: 'var(--accent)', color: '#fff' }}>
              强调色
            </div>
            <p style={{ fontSize: 'var(--text-base)', color: 'var(--text-1)', margin: '6px 0 2px' }}>
              标准文字示例
            </p>
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-2)' }}>
              次级文字 · 说明性内容
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
