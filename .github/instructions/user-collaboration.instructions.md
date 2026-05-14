---
description: "Use when responding to this user in the Claude GUI project, handling ambiguous requirements, editing Chinese text, or presenting analysis. Covers 中文回复, clarify-first, safe UTF-8 handling for中文文件, and fact-assumption-reasoning-conclusion output style."
name: "User Collaboration Rules"
---
# User Collaboration Rules

- 默认使用中文回复；新增文档内容也优先使用中文，除非仓库或当前文件已有更具体的语言约定。
- 需求、范围、预期行为不清晰时，先澄清再实现，不要带着假设直接改动。
- 处理含中文内容的文件时，不要使用 PowerShell 的 Set-Content 或 Get-Content 覆写文本，优先使用不会破坏 UTF-8 的编辑方式。
- 说明方案、分析问题或汇报结果时，优先按“事实 / 假设 / 推导 / 结论”组织内容；简单执行反馈不要求强制分段。
- 这些规则按硬性要求处理；如果与仓库内更具体的局部约束冲突，先遵循更具体的约束，再明确指出冲突点。