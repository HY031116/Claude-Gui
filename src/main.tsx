import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { isElectron, webAPI } from './lib/transport'

// Web 模式下，将 webAPI 注入为 window.electronAPI，
// 使所有现有代码无需修改即可在浏览器中运行
if (!isElectron()) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).electronAPI = webAPI;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
