import * as http from 'http';
import * as readline from 'readline';

type JsonRpcId = string | number | null;

interface JsonRpcMessage {
  jsonrpc?: string;
  id?: JsonRpcId;
  method?: string;
  params?: Record<string, unknown>;
}

function writeResult(id: JsonRpcId | undefined, result: unknown): void {
  if (id === undefined) return;
  process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id, result }) + '\n');
}

function writeError(id: JsonRpcId | undefined, code: number, message: string): void {
  if (id === undefined) return;
  process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id, error: { code, message } }) + '\n');
}

function postToolRequest(urlEnvKey: 'CLAUDE_GUI_PERMISSION_URL' | 'CLAUDE_GUI_QUESTION_URL', payload: unknown, fallbackMessage: string): Promise<unknown> {
  const url = process.env[urlEnvKey];
  if (!url) {
    return Promise.resolve({ error: fallbackMessage });
  }

  return new Promise((resolve) => {
    const body = JSON.stringify(payload ?? {});
    const req = http.request(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Length': Buffer.byteLength(body),
      },
      timeout: 60 * 60 * 1000,
    }, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (chunk: Buffer) => chunks.push(chunk));
      res.on('end', () => {
        try {
          const text = Buffer.concat(chunks).toString('utf8');
          resolve(JSON.parse(text || '{}'));
        } catch (error) {
          resolve({ error: `GUI 工具桥响应无效：${String(error)}` });
        }
      });
    });

    req.on('timeout', () => {
      req.destroy();
      resolve({ error: fallbackMessage });
    });
    req.on('error', (error) => {
      resolve({ error: `GUI 工具桥不可用：${String(error)}` });
    });
    req.end(body);
  });
}

async function handleMessage(message: JsonRpcMessage): Promise<void> {
  const { id, method, params } = message;

  if (method === 'initialize') {
    writeResult(id, {
      protocolVersion: typeof params?.protocolVersion === 'string' ? params.protocolVersion : '2024-11-05',
      capabilities: { tools: {} },
      serverInfo: { name: 'claude-code-gui-permission', version: '1.0.0' },
    });
    return;
  }

  if (method === 'notifications/initialized') return;

  if (method === 'ping') {
    writeResult(id, {});
    return;
  }

  if (method === 'tools/list') {
    writeResult(id, {
      tools: [
        {
          name: 'gui_permission_prompt',
          description: 'Ask the Claude Code GUI user to allow or deny a pending Claude Code tool call.',
          inputSchema: { type: 'object', additionalProperties: true },
        },
        {
          name: 'vscode_askQuestions',
          description: 'Show a GUI dialog with selectable questions and return the user answers.',
          inputSchema: {
            type: 'object',
            properties: {
              questions: {
                type: 'array',
                minItems: 1,
                items: {
                  type: 'object',
                  properties: {
                    header: { type: 'string' },
                    question: { type: 'string' },
                    multiSelect: { type: 'boolean' },
                    allowFreeformInput: { type: 'boolean' },
                    message: { type: 'string' },
                    options: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          label: { type: 'string' },
                          description: { type: 'string' },
                          recommended: { type: 'boolean' },
                        },
                        required: ['label'],
                        additionalProperties: false,
                      },
                    },
                  },
                  required: ['header', 'question'],
                  additionalProperties: false,
                },
              },
            },
            required: ['questions'],
            additionalProperties: false,
          },
        },
        {
          name: 'askquestion',
          description: 'Alias of vscode_askQuestions for prompting the GUI user with selectable questions.',
          inputSchema: {
            type: 'object',
            properties: {
              questions: { type: 'array' },
            },
            required: ['questions'],
            additionalProperties: true,
          },
        },
      ],
    });
    return;
  }

  if (method === 'tools/call') {
    const toolName = typeof params?.name === 'string' ? params.name : '';
    if (!['gui_permission_prompt', 'vscode_askQuestions', 'askquestion'].includes(toolName)) {
      writeError(id, -32602, `Unknown tool: ${toolName}`);
      return;
    }

    const result = toolName === 'gui_permission_prompt'
      ? await postToolRequest('CLAUDE_GUI_PERMISSION_URL', params?.arguments ?? {}, 'GUI 权限审批超时，已自动拒绝工具调用。')
      : await postToolRequest('CLAUDE_GUI_QUESTION_URL', params?.arguments ?? {}, 'GUI 询问弹窗超时，已自动跳过问题。');

    writeResult(id, {
      content: [{ type: 'text', text: JSON.stringify(result) }],
    });
    return;
  }

  writeError(id, -32601, `Unknown method: ${method ?? ''}`);
}

const rl = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });

rl.on('line', (line) => {
  if (!line.trim()) return;
  try {
    const message = JSON.parse(line) as JsonRpcMessage;
    void handleMessage(message).catch((error) => {
      writeError(message.id, -32603, String(error));
    });
  } catch (error) {
    process.stderr.write(`Invalid MCP JSON-RPC message: ${String(error)}\n`);
  }
});