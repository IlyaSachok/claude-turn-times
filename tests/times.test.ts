import { describe, expect, mock, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'
import type { On } from 'claude-code'

const pad = (n: number): string => String(n).padStart(2, '0')
const at = (ms: number): string => {
  const d = new Date(ms)
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

const NOW = Date.UTC(2026, 9, 9, 8, 30, 15)

type Block = { type: string; [field: string]: unknown }

const modelRow = (uuid: string, content: Block[], agentId?: string) => ({
  message: { type: 'assistant' as const, content },
  door: 'response' as const,
  origin: { kind: 'model' as const, model: 'claude-test' },
  uuid,
  ...(agentId === undefined ? {} : { agentId }),
})

const text = (words: string): Block => ({ type: 'text', text: words })
const toolUse: Block = { type: 'tool_use', id: 'tool-1', name: 'Read', input: {} }

const complete = (extra: object = {}) => ({
  answer: 'done',
  durationMs: 46_000,
  isAborted: false,
  turnId: 't1',
  reason: 'answer' as const,
  ...extra,
})

const engine = (on: On): void => {
  mock.clock(on, { now: NOW })
  mock.store(on)
  mock.session(on)
  on('turn.complete', () => ({ text: 'done' }))
  on('ui.render', { component: 'AssistantMessage' }, (_$, e) => ({ type: 'Text', children: [e.props.text] }))
}

const drawn = async ($: Engine, requestId: string, words: string): Promise<string> =>
  JSON.stringify(
    await $.ui.render({ component: 'AssistantMessage', surface: 'desktop', requestId, props: { text: words, isFirstOfReply: true } }),
  )

const LINE = `Старт ответа ${at(NOW - 46_000)} · конец ${at(NOW)} · 46 с`

describe('turn-times', () => {
  test('only the last text block of the turn gets the line', async ($, on) => {
    engine(on)

    await $.session.append(modelRow('row-1', [text('Сначала посмотрю.')]))
    await $.session.append(modelRow('row-tool', [toolUse]))
    await $.session.append(modelRow('row-2', [text('Готово.')]))
    await $.turn.complete(complete())

    expect(await drawn($, 'row-1', 'Сначала посмотрю.')).not.toContain('Старт ответа')
    expect(await drawn($, 'row-tool', '')).not.toContain('Старт ответа')
    expect(await drawn($, 'row-2', 'Готово.')).toContain(LINE)
  })

  test('the answer itself is passed on unchanged, nothing is shown beneath it', async ($, on) => {
    engine(on)

    await $.session.append(modelRow('row-1', [text('Готово.')]))
    const shown = await $.turn.complete(complete())

    expect(shown.text).toBe('done')
  })

  test('a long turn is told in minutes', async ($, on) => {
    engine(on)

    await $.session.append(modelRow('row-1', [text('Готово.')]))
    await $.turn.complete(complete({ durationMs: 125_000 }))

    expect(await drawn($, 'row-1', 'Готово.')).toContain('· 2 мин 05 с')
  })

  test('an interrupted turn says so', async ($, on) => {
    engine(on)

    await $.session.append(modelRow('row-1', [text('Начал')]))
    await $.turn.complete(complete({ reason: 'aborted', isAborted: true }))

    expect(await drawn($, 'row-1', 'Начал')).toContain('· прервано')
  })

  test('a subagent neither claims the main turn line nor gets one', async ($, on) => {
    engine(on)

    await $.session.append(modelRow('row-main', [text('Итог.')]))
    await $.session.append(modelRow('row-sub', [text('Отчёт субагента.')], 'agent-1'))
    await $.turn.complete(complete({ agentId: 'agent-1' }))
    expect(await drawn($, 'row-sub', 'Отчёт субагента.')).not.toContain('Старт ответа')

    await $.turn.complete(complete())
    expect(await drawn($, 'row-main', 'Итог.')).toContain(LINE)
    expect(await drawn($, 'row-sub', 'Отчёт субагента.')).not.toContain('Старт ответа')
  })

  test('a turn with no text block leaves the transcript alone', async ($, on) => {
    engine(on)

    await $.session.append(modelRow('row-tool', [toolUse]))
    await $.turn.complete(complete())

    expect(await drawn($, 'row-tool', '')).not.toContain('Старт ответа')
  })
})
