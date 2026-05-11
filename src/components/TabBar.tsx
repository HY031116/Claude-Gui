
export interface TabItem<T extends string = string> {
  key: T;
  label: string;
}

interface TabBarProps<T extends string = string> {
  tabs: TabItem<T>[];
  activeTab: T;
  onChange: (key: T) => void;
}

export function TabBar<T extends string = string>({ tabs, activeTab, onChange }: TabBarProps<T>) {
  return (
    <div style={{ display: 'flex', gap: 0, marginBottom: 16, borderBottom: '2px solid var(--border-color)' }}>
      {tabs.map(t => (
        <button
          key={t.key}
          onClick={() => onChange(t.key)}
          style={{
            flex: 1,
            padding: '6px 4px',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === t.key ? '2px solid var(--accent-color)' : '2px solid transparent',
            marginBottom: -2,
            color: activeTab === t.key ? 'var(--accent-color)' : 'var(--text-secondary)',
            fontSize: 11,
            fontWeight: activeTab === t.key ? 600 : 400,
            cursor: 'pointer',
            transition: 'color 0.15s',
          }}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
