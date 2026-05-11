const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const chunks = [];
const STOP_BLOCK_LIMIT = 2;

process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => chunks.push(chunk));
process.stdin.on('end', () => {
  let payload = {};

  try {
    const raw = chunks.join('').trim();
    payload = raw ? JSON.parse(raw) : {};
  } catch {
    payload = {};
  }

  const eventName =
    payload.hookEventName ||
    payload.eventName ||
    payload.event ||
    payload.hook_event_name ||
    '';

  const toolName =
    payload.tool_name ||
    payload.toolName ||
    payload.tool?.name ||
    payload.hookSpecificInput?.toolName ||
    '';

  const output = buildOutput(eventName, toolName, payload);

  process.stdout.write(
    JSON.stringify(output, null, 2),
  );
});

process.stdin.resume();

function getStopStatePath(payload) {
  const sessionKey = payload.sessionId || payload.session_id || payload.transcript_path || 'default';
  const safeKey = String(sessionKey).replace(/[^a-zA-Z0-9._-]/g, '_');

  return path.join(os.tmpdir(), `continuous-iteration-stop-${safeKey}.json`);
}

function readStopState(payload) {
  const statePath = getStopStatePath(payload);

  try {
    const raw = fs.readFileSync(statePath, 'utf8');
    const parsed = JSON.parse(raw);

    return {
      statePath,
      blockCount: Number.isFinite(parsed.blockCount) ? parsed.blockCount : 0,
    };
  } catch {
    return {
      statePath,
      blockCount: 0,
    };
  }
}

function writeStopState(statePath, blockCount) {
  fs.writeFileSync(
    statePath,
    JSON.stringify({ blockCount }),
    'utf8',
  );
}

function clearStopState(statePath) {
  try {
    fs.unlinkSync(statePath);
  } catch {
    // Ignore missing or locked state files.
  }
}

function buildOutput(eventName, toolName, payload) {
  if (eventName === 'SessionStart') {
    return {
      continue: true,
      hookSpecificOutput: {
        hookEventName: 'SessionStart',
        additionalContext: [
          '执行策略：你不是一次性回答器，而是持续推进器。',
          '先从基础事实拆解目标、约束、当前阻塞，再生成最小可执行计划。',
          '每次只推进一个最小闭环：定位 -> 修改 -> 验证 -> 记录结论 -> 决定下一步。',
          '当前闭环完成后，如果仍存在明确且可验证的最小下一步，直接继续推进，不要把闭环误判为结束。',
        ].join('\n'),
      },
    };
  }

  if (eventName === 'UserPromptSubmit') {
    return {
      continue: true,
      systemMessage: '已注入持续推进策略。',
      hookSpecificOutput: {
        hookEventName: 'UserPromptSubmit',
        additionalContext: [
          '处理本次请求时，先拆解目标、约束、完成标准，再决定动作。',
          '如果任务可以执行，就优先产出最小计划并立即推进，不要停留在泛化建议。',
          '如果需求存在关键歧义，只提最少问题；一旦足够执行，就继续完成当前闭环并衔接最小下一步。',
        ].join('\n'),
      },
    };
  }

  if (eventName === 'PostToolUse') {
    const toolSuffix = toolName ? `最近工具：${toolName}。` : '最近完成了一次工具调用。';

    return {
      continue: true,
      hookSpecificOutput: {
        hookEventName: 'PostToolUse',
        additionalContext: [
          `${toolSuffix}`,
          '现在立即判断：这一步是否改变了事实、暴露了新约束、或产生了可执行后续？',
          '如果刚刚进行了代码修改，下一步优先做最窄验证，不要先扩大阅读或继续堆叠修改。',
          '如果验证已通过，则基于结果选择最小相邻步骤继续推进；即使当前闭环完成，也要先判断并衔接下一步。',
        ].join('\n'),
      },
    };
  }

  if (eventName === 'Stop') {
    const { statePath, blockCount } = readStopState(payload);

    if (!payload.stop_hook_active) {
      writeStopState(statePath, 1);

      return {
        continue: true,
        systemMessage: '检测到会话准备结束，先执行一次闭环自检。',
        hookSpecificOutput: {
          hookEventName: 'Stop',
          decision: 'block',
          reason: [
            '先确认当前目标是否真正闭环。',
            '如果还存在未验证假设、未执行验证，请继续推进后再结束。',
            '如果当前闭环已经完成，但存在明确且可执行的最小下一步，请直接切换到下一步继续推进，不要结束会话。',
            `这是本轮停止检查的第 1/${STOP_BLOCK_LIMIT} 次阻断。`,
            '完成后再收尾，并明确结果、验证结论、剩余风险和下一步建议。',
          ].join('\n'),
        },
      };
    }

    if (blockCount >= STOP_BLOCK_LIMIT) {
      clearStopState(statePath);

      return {
        continue: true,
        systemMessage: `Stop hook 已连续阻断 ${blockCount} 次；仅在当前没有明确可执行下一步时，才允许本次结束以避免无限循环。`,
      };
    }

    const nextBlockCount = blockCount + 1;
    writeStopState(statePath, nextBlockCount);

    return {
      continue: true,
      systemMessage: '检测到会话仍准备结束，继续执行闭环自检。',
      hookSpecificOutput: {
        hookEventName: 'Stop',
        decision: 'block',
        reason: [
          '先确认当前目标是否真正闭环。',
          '如果还存在未验证假设、未执行验证，请继续推进后再结束。',
          '如果当前闭环已经完成，但存在明确且可执行的最小下一步，请直接切换到下一步继续推进，不要结束会话。',
          `这是本轮停止检查的第 ${nextBlockCount}/${STOP_BLOCK_LIMIT} 次阻断。`,
          '完成后再收尾，并明确结果、验证结论、剩余风险和下一步建议。',
        ].join('\n'),
      },
    };
  }

  return {
    continue: true,
    systemMessage: '保持迭代推进：用最新事实更新判断，优先选择最小且可验证的下一步。',
  };
}