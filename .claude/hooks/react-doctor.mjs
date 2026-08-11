// Claude Code agent hook: after a tool batch that edited files, runs React
// Doctor over the changed files and, when the scan reports diagnostics, feeds
// a JSON excerpt back to the agent as additional context. Never blocks the
// agent loop: any runner, scan, or parse failure exits 0 silently.
import { existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// JSON reports on large diffs can exceed spawnSync's 1 MiB default.
const SPAWN_MAX_BUFFER_BYTES = 16 * 1024 * 1024;

// Serialized-diagnostics byte budget for the agent message, so one scan of a
// large diff cannot flood the model's context window.
const MAX_CONTEXT_BYTES = 30000;

const EDIT_TOOL_NAMES = new Set(['Edit', 'Write', 'MultiEdit', 'NotebookEdit', 'ApplyPatch']);

// `--scope changed` scans every change relative to the auto-detected git
// base, not just the files this batch touched — deliberate, so a late batch
// still surfaces regressions from earlier edits in the session. `--json`
// keeps stdout machine-readable, `--blocking none` keeps the exit status
// advisory, and `--no-score` skips the score API and crash reporting.
const SCAN_FLAGS = '--json --json-compact --scope changed --blocking none --no-score';

const readFileOrEmpty = (source) => {
  try {
    return readFileSync(source, 'utf8');
  } catch {
    return '';
  }
};

const shouldScan = (input) => {
  const eventName = input.hook_event_name || input.eventName || input.event_name;
  if (eventName === 'PostToolBatch') {
    const toolCalls = Array.isArray(input.tool_calls) ? input.tool_calls : [];
    return toolCalls.some((toolCall) => EDIT_TOOL_NAMES.has(toolCall.tool_name));
  }
  const toolName = input.tool_name || input.toolName || input.tool;
  return !toolName || EDIT_TOOL_NAMES.has(toolName);
};

const runReactDoctor = () => {
  // Each candidate is a single shell command string (not an args array):
  // `shell: true` is required to run the Windows `.cmd` shims, and an args
  // array with `shell: true` trips Node's DEP0190. A missing command exits
  // 127 via a POSIX shell (no ENOENT error) and 9009 via cmd.exe, so fall
  // through on those. Only lockfile-pinned runners are allowed — the project
  // bin and `pnpm exec` both resolve the locally installed react-doctor;
  // there is deliberately no network-fetching fallback (`pnpm dlx` / `npx`
  // `@latest`). With no runner found, return null and skip the scan.
  const localBin =
    process.platform === 'win32'
      ? 'node_modules\\.bin\\react-doctor.cmd'
      : './node_modules/.bin/react-doctor';
  const commands = [
    ...(existsSync(localBin) ? [`${localBin} ${SCAN_FLAGS}`] : []),
    `pnpm exec react-doctor ${SCAN_FLAGS}`,
  ];

  for (const command of commands) {
    const result = spawnSync(command, {
      encoding: 'utf8',
      shell: true,
      maxBuffer: SPAWN_MAX_BUFFER_BYTES,
    });
    if (result.error?.code === 'ENOENT' || result.status === 127 || result.status === 9009) continue;
    return result;
  }

  return null;
};

const parseReport = (text) => {
  try {
    const parsed = JSON.parse(text.trim());
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
};

const main = () => {
  let input;
  try {
    input = JSON.parse(readFileOrEmpty(0) || '{}');
  } catch {
    input = {};
  }

  if (!shouldScan(input)) {
    process.exit(0);
  }

  const projectRoot = process.env.CLAUDE_PROJECT_DIR || join(__dirname, '../..');

  try {
    process.chdir(projectRoot);
  } catch {
    process.exit(0);
  }

  const scan = runReactDoctor();
  if (!scan) {
    process.exit(0);
  }

  // Decide from the report content, not the exit status: `--blocking none`
  // keeps findings advisory, and a crash produces either non-JSON output or
  // an `ok: false` error report — both exit silently below. Try stdout alone
  // first (react-doctor keeps it machine-clean under `--json`), then the
  // combined streams in case the report landed on stderr.
  const stdout = scan.stdout || '';
  const report = parseReport(stdout) ?? parseReport(stdout + (scan.stderr || ''));
  if (!report || report.schemaVersion !== 3 || report.ok !== true) {
    process.exit(0);
  }

  const diagnostics = Array.isArray(report.diagnostics) ? report.diagnostics : [];
  if (diagnostics.length === 0) {
    process.exit(0);
  }

  // Truncate to the byte budget by dropping whole diagnostics rather than
  // substring-cutting JSON, so what the agent receives always parses.
  const included = [];
  let serializedBytes = 0;
  for (const diagnostic of diagnostics) {
    const serialized = JSON.stringify(diagnostic);
    if (included.length > 0 && serializedBytes + serialized.length > MAX_CONTEXT_BYTES) break;
    included.push(diagnostic);
    serializedBytes += serialized.length;
  }
  const truncationNotice =
    included.length < diagnostics.length
      ? `\n\n[Output truncated: showing ${included.length} of ${diagnostics.length} diagnostics.]`
      : '';

  const payload = JSON.stringify({ summary: report.summary, diagnostics: included });
  const message = `React Doctor found issues in the changed files. Review this JSON report and fix the regressions before finishing. For confirmed issues that cannot be fixed now, create GitHub issues with the rule, file/line, impact, and proposed fix.\n\n${payload}${truncationNotice}`;

  if (input.hook_event_name === 'PostToolBatch') {
    console.log(
      JSON.stringify({
        hookSpecificOutput: { hookEventName: 'PostToolBatch', additionalContext: message },
      }),
    );
  } else {
    console.log(JSON.stringify({ additional_context: message }));
  }
};

main();
