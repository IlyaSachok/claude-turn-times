import type { Register } from 'claude-code'

type Turn = { startedAt: number; endedAt: number; reason: string }

const KEEP = 1000

const pad = (n: number): string => String(n).padStart(2, '0')

const clock = (ms: number): string => {
  const at = new Date(ms)
  return `${pad(at.getHours())}:${pad(at.getMinutes())}:${pad(at.getSeconds())}`
}

const length = (ms: number): string => {
  const seconds = Math.max(0, Math.round(ms / 1000))
  return seconds < 60 ? `${seconds} с` : `${Math.floor(seconds / 60)} мин ${pad(seconds % 60)} с`
}

const ENDINGS: Readonly<Record<string, string>> = {
  aborted: ' · прервано',
  error: ' · ошибка',
  refusal: ' · отказ модели',
}

const describeTurn = (turn: Turn): string =>
  `Старт ответа ${clock(turn.startedAt)} · конец ${clock(turn.endedAt)} · ${length(turn.endedAt - turn.startedAt)}${ENDINGS[turn.reason] ?? ''}`

const asTurn = (value: unknown): Turn | undefined => {
  const turn = value as Partial<Turn> | null | undefined
  return turn !== null &&
    turn !== undefined &&
    typeof turn.startedAt === 'number' &&
    typeof turn.endedAt === 'number' &&
    typeof turn.reason === 'string'
    ? { startedAt: turn.startedAt, endedAt: turn.endedAt, reason: turn.reason }
    : undefined
}

const asTurns = (value: unknown): Record<string, Turn> =>
  value !== null && typeof value === 'object' ? (value as Record<string, Turn>) : {}

const hasText = (blocks: ReadonlyArray<{ type: string; [field: string]: unknown }>): boolean =>
  blocks.some(block => block.type === 'text' && typeof block.text === 'string' && block.text.trim() !== '')

export const register: Register = on => {
  let turns: Record<string, Turn> = {}
  let lastTextRow: string | undefined

  on('session.start', async ($, e, next) => {
    turns = asTurns(await $.store.get('turns'))
    $.ui.invalidate('ui.render')
    return next(e)
  })

  on('session.append', { door: 'response' }, ($, e, next) => {
    if (e.agentId === undefined && e.message.type === 'assistant' && hasText(e.message.content)) {
      lastTextRow = e.uuid
    }
    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    const answered = await next(e)
    if (e.agentId !== undefined) return answered

    const endedAt = await $.clock.now()
    const turn: Turn = { startedAt: endedAt - e.durationMs, endedAt, reason: e.reason }
    const row = lastTextRow
    lastTextRow = undefined

    if (row !== undefined) {
      // Several sessions share the store: re-read it so one does not drop the rows another just added.
      const stored = asTurns(await $.store.get('turns'))
      turns = Object.fromEntries(Object.entries({ ...stored, ...turns, [row]: turn }).slice(-KEEP))
      await $.store.set('turns', turns)
    }

    $.ui.status(describeTurn(turn))
    $.ui.invalidate('ui.render')
    return answered
  })

  on('ui.render', { component: 'AssistantMessage' }, ($, e, next) => {
    const turn = asTurn(turns[e.requestId])
    if (turn === undefined || e.props.isSummary === true) return next(e)
    return next({ ...e, props: { ...e.props, text: `${e.props.text}\n\n*${describeTurn(turn)}*` } })
  })
}
