$file = "d:\My Project\claude\claude-code-gui\src\components\SettingsPanel.tsx"
$lines = [System.IO.File]::ReadAllLines($file, [System.Text.Encoding]::UTF8)

$fixes = @{
  34 = "  // MCP 服务器状态"  # line index 33 (0-based)
  36 = "  // Plugins 状态"    # line index 35 (0-based)
  38 = "  // 可用 agents 列表（从 CLI 加载）"  # line index 37 (0-based)
}

$changed = 0
for ($i = 0; $i -lt $lines.Length; $i++) {
  $lineNum = $i + 1
  if ($lines[$i] -match "^  // MCP.*态" -or $lines[$i] -match "^  // MCP.*\uFFFD") {
    Write-Host "Line ${lineNum}: MCP comment: $($lines[$i])"
    $lines[$i] = "  // MCP 服务器状态"
    $changed++
  } elseif ($lines[$i] -match "^  // Plugins.*态" -or $lines[$i] -match "^  // Plugins.*\uFFFD") {
    Write-Host "Line ${lineNum}: Plugins comment: $($lines[$i])"
    $lines[$i] = "  // Plugins 状态"
    $changed++
  } elseif ($lines[$i] -match "^  // 可用 agents.*\uFFFD" -or $lines[$i] -match "^  // 可用 agents.*加载") {
    Write-Host "Line ${lineNum}: agents comment: $($lines[$i])"
    $lines[$i] = "  // 可用 agents 列表（从 CLI 加载）"
    $changed++
  } elseif ($lines[$i] -match "^\s+// 初始.*\uFFFD") {
    Write-Host "Line ${lineNum}: 初始化 comment: $($lines[$i])"
    $lines[$i] = "        // 初始化 MCP 和 Plugins 状态"
    $changed++
  }
}

Write-Host "Fixed $changed lines."
[System.IO.File]::WriteAllLines($file, $lines, [System.Text.UTF8Encoding]::new($false))
Write-Host "Done."
