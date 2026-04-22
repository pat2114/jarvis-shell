import { invokeClaudeAgent } from '../llm/claudeCli'
import type { RepairErrorReport, RepairPlan } from './types'

const APPEND_SYSTEM = `You are an autonomous repair agent for the Atelier codebase you have been dropped into. Your task is to implement a specific fix described in a repair plan.

Workflow you MUST follow, in order:
1. Read the plan carefully. Read the files it mentions.
2. BEFORE touching production code, write a regression test that fails without the fix (matching regressionTestIdea in the plan). Put it under tests/ using the existing Playwright style if UI-adjacent, or under tests/unit/ as a .test.ts file otherwise.
3. Implement the minimal fix. Do not refactor unrelated code. Do not rename things. Do not format unrelated files.
4. Run \`npm run typecheck\`. If it fails, iterate until it passes.
5. Run the new test. If it fails, iterate until it passes.
6. Do NOT commit — the orchestrator commits once the reviewer approves.
7. When you are finished, output a short summary in this format exactly:

REPAIR_DONE
files_changed: <comma-separated paths>
typecheck: pass|fail
new_test_passes: true|false|n/a
notes: <one sentence>

If you cannot produce a fix (unclear plan, problem outside scope, etc.), output:

REPAIR_ABORTED
reason: <one sentence>

Constraints:
- Stay within the plan's filesLikelyInvolved unless absolutely necessary.
- Never modify package.json, electron-builder.yml, or CI files unless the plan explicitly calls for it.
- Never install new dependencies unless the plan explicitly calls for it.
- Never touch files under src/main/repair/ or src/main/llm/claudeCli.ts — those are the repair system itself.
- Never delete tests. Never relax assertion strictness to make a failing test pass.`

export type RepairAttemptOutcome = {
  success: boolean
  rawOutput: string
  summary: string
  error?: string
}

export async function attemptRepair(input: {
  plan: RepairPlan
  report: RepairErrorReport
  sandboxCwd: string
  priorFeedback?: string
}): Promise<RepairAttemptOutcome> {
  const feedbackBlock = input.priorFeedback
    ? `\n\nPRIOR REVIEWER FEEDBACK (address this in your new attempt):\n${input.priorFeedback}`
    : ''

  const task = `Repair plan:
${JSON.stringify(input.plan, null, 2)}

Original error:
- message: ${input.report.message}
${input.report.stack ? `- stack:\n${input.report.stack}` : ''}
${input.report.stepId ? `- pipeline step: ${input.report.stepId}` : ''}${feedbackBlock}

Implement the fix following the workflow in your system prompt.`

  const result = await invokeClaudeAgent({
    task,
    appendSystemPrompt: APPEND_SYSTEM,
    cwd: input.sandboxCwd,
    model: 'sonnet',
    timeoutMs: 10 * 60 * 1000
  })

  if (!result.ok) {
    return { success: false, rawOutput: result.rawText ?? '', summary: '', error: result.error }
  }

  const text = result.text
  if (text.includes('REPAIR_DONE')) {
    return { success: true, rawOutput: text, summary: extractSummary(text, 'REPAIR_DONE') }
  }
  if (text.includes('REPAIR_ABORTED')) {
    return {
      success: false,
      rawOutput: text,
      summary: extractSummary(text, 'REPAIR_ABORTED'),
      error: 'agent aborted — see summary'
    }
  }
  return {
    success: false,
    rawOutput: text,
    summary: '',
    error: 'agent output did not contain REPAIR_DONE or REPAIR_ABORTED marker'
  }
}

function extractSummary(text: string, marker: string): string {
  const idx = text.indexOf(marker)
  if (idx < 0) return ''
  return text.slice(idx).trim()
}
