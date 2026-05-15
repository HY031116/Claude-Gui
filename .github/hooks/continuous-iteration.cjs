const fs = require('fs');
const os = require('os');
const path = require('path');

const STATE_DIR = path.join(os.tmpdir(), 'copilot-hook-state');
const MAX_STOP_BLOCKS = 2;

function readStdin() {
  return new Promise((resolve, reject) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => {
      data += chunk;
    });
    process.stdin.on('end', () => resolve(data.trim()));
    process.stdin.on('error', reject);
  });
}

function writeJson(payload) {
  process.stdout.write(JSON.stringify(payload));
}

function ensureStateDir() {
  fs.mkdirSync(STATE_DIR, { recursive: true });
}

function getStateFile(sessionId) {
  const safeSessionId = String(sessionId || 'unknown').replace(/[^a-zA-Z0-9_-]/g, '_');
  return path.join(STATE_DIR, `continuous-iteration-${safeSessionId}.json`);
}

function loadState(sessionId) {
  try {
    return JSON.parse(fs.readFileSync(getStateFile(sessionId), 'utf8'));
  } catch {
    return { stopBlocks: 0 };
  }
}

function saveState(sessionId, state) {
  ensureStateDir();
  fs.writeFileSync(getStateFile(sessionId), JSON.stringify(state), 'utf8');
}

function shouldInjectPostToolContext(toolName) {
  if (!toolName) {
    return false;
  }

  return /apply_patch|create_file|edit|write|replace|run_in_terminal|get_errors|manage_todo_list/i.test(toolName);
}

function findDesignDoc(cwd) {
  if (!cwd) {
    return null;
  }

  const candidate = path.join(cwd, 'docs', 'PRODUCT_DESIGN.md');
  return fs.existsSync(candidate) ? 'docs/PRODUCT_DESIGN.md' : null;
}

function extractGoalSignals(cwd) {
  const designDoc = findDesignDoc(cwd);
  if (!designDoc) {
    return null;
  }

  try {
    const fullPath = path.join(cwd, designDoc);
    const lines = fs.readFileSync(fullPath, 'utf8').split(/\r?\n/);
    const versionLine = lines.find((line) => line.startsWith('> 版本：'));
    const scopeLine = lines.find((line) => line.startsWith('> 适用范围：'));
    const roadmapStart = lines.findIndex((line) => line.includes('渐进式实现路线'));
    const roadmapLines = roadmapStart >= 0
      ? lines
        .slice(roadmapStart + 1)
        .filter((line) => /^(MVP|v\d+(\.\d+)?)/.test(line.trim()))
        .slice(0, 3)
      : [];

    return {
      designDoc,
      version: versionLine ? versionLine.replace(/^>\s*版本：/, '').trim() : null,
      scope: scopeLine ? scopeLine.replace(/^>\s*适用范围：/, '').trim() : null,
      roadmap: roadmapLines.map((line) => line.trim()),
    };
  } catch {
    return { designDoc, version: null, scope: null, roadmap: [] };
  }
}

function buildGoalSourceText(cwd) {
  const goalSignals = extractGoalSignals(cwd);
  if (!goalSignals) {
    return '最终目标优先依据当前用户请求；如果项目内存在设计文档，也要把它视为范围和完成标准的一部分。';
  }

  const parts = [`最终目标优先依据当前用户请求，同时对齐 ${goalSignals.designDoc}。`];
  if (goalSignals.version) {
    parts.push(`当前文档版本信号：${goalSignals.version}。`);
  }
  if (goalSignals.scope) {
    parts.push(`当前适用范围：${goalSignals.scope}。`);
  }
  if (goalSignals.roadmap.length > 0) {
    parts.push(`近期路线：${goalSignals.roadmap.join(' / ')}。`);
  }

  return parts.join(' ');
}

function buildGoalReminderText(cwd) {
  const goalSignals = extractGoalSignals(cwd);
  if (!goalSignals) {
    return '先回看当前用户请求，并结合项目设计文档判断最终目标是否真的完成。';
  }

  const parts = [`先回看当前用户请求，并对照 ${goalSignals.designDoc}`];
  if (goalSignals.version) {
    parts.push(`的版本信号 ${goalSignals.version}`);
  }
  if (goalSignals.scope) {
    parts.push(`和适用范围 ${goalSignals.scope}`);
  }

  return `${parts.join(' ')} 判断最终目标是否真的完成。`;
}

function buildSessionContext(cwd) {
  return [
    '持续推进模式已启用。',
    buildGoalSourceText(cwd),
    '先识别最终目标或当前版本目标，再把工作拆成最小可验证闭环。',
    '每完成一个闭环，必须立即判断是否还有明确、可直接执行的下一步。',
    '如果最终目标未完成且不存在外部阻塞，不要因为一个子任务完成就结束。',
    '只有在最终目标完成并验证、用户明确要求暂停、或确实缺少外部条件时才停止。',
  ].join(' ');
}

function buildPostToolContext() {
  return [
    '本次关键操作已完成。',
    '现在先验证当前闭环是否成立。',
    '若验证已通过且最终目标仍未完成，继续推进下一个最小任务，而不是在当前子任务处收尾。',
  ].join(' ');
}

function buildStopReason(blockCount, cwd) {
  const goalSource = buildGoalReminderText(cwd);

  if (blockCount === 1) {
    return `${goalSource} 不要在完成当前子任务后立即停止；如果最终目标未完成且存在明确的最小下一步，请继续推进。`;
  }

  return `${goalSource} 你仍处于持续推进模式。只有在最终目标完成、用户明确要求暂停、或存在无法自行解除的外部阻塞时，才允许停止。`;
}

async function main() {
  const rawInput = await readStdin();
  const input = rawInput ? JSON.parse(rawInput) : {};
  const eventName = input.hookEventName;
  const sessionId = input.sessionId || 'unknown';

  if (eventName === 'SessionStart') {
    saveState(sessionId, { stopBlocks: 0 });
    writeJson({
      hookSpecificOutput: {
        hookEventName: 'SessionStart',
        additionalContext: buildSessionContext(input.cwd),
      },
    });
    return;
  }

  if (eventName === 'PostToolUse') {
    if (!shouldInjectPostToolContext(input.tool_name)) {
      writeJson({});
      return;
    }

    writeJson({
      hookSpecificOutput: {
        hookEventName: 'PostToolUse',
        additionalContext: buildPostToolContext(),
      },
    });
    return;
  }

  if (eventName === 'Stop') {
    const state = loadState(sessionId);
    const currentBlocks = Number.isFinite(state.stopBlocks) ? state.stopBlocks : 0;

    if (currentBlocks >= MAX_STOP_BLOCKS) {
      writeJson({
        systemMessage: 'continuous-iteration: 已达到停止阻断上限，本次允许结束，以避免无限循环。',
      });
      return;
    }

    const nextBlocks = currentBlocks + 1;
    saveState(sessionId, { stopBlocks: nextBlocks });
    writeJson({
      hookSpecificOutput: {
        hookEventName: 'Stop',
        decision: 'block',
        reason: buildStopReason(nextBlocks, input.cwd),
      },
    });
    return;
  }

  writeJson({});
}

main().catch((error) => {
  process.stderr.write(`continuous-iteration hook failed: ${error.message}`);
  process.exit(1);
});