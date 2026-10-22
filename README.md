# claude-turn-times

A Claude Code mod that shows when every answer started and ended.

When an answer is complete, an italic line is added under its last text block, and the same line is shown in the status line:

> Старт ответа 14:03:12 · конец 14:03:58 · 46 с

The line is only drawn: it is not stored in the conversation and the model never sees it. It is in Russian; to change the wording, edit the strings in `hooks/register.ts`.

## Install

In a terminal Claude Code session:

```
/plugin install turn-times --marketplace IlyaSachok/claude-turn-times
```

Answer `y` to add the marketplace, then pick the user scope. A mod installed this way at the user scope also loads in the sessions the desktop app starts.

Or clone it straight into the skills folder (the folder must be named `turn-times`):

```
# macOS / Linux
git clone https://github.com/IlyaSachok/claude-turn-times.git ~/.claude/skills/turn-times

# Windows (PowerShell)
git clone https://github.com/IlyaSachok/claude-turn-times.git "$env:USERPROFILE\.claude\skills\turn-times"
```

Start a new session afterwards.

## Notes

- Needs a Claude Code version with function-hook mods. Written against 2.1.293; `claude plugin validate` and the tests also pass on 2.1.295 and 2.1.304. The API is early access and may change between releases.
- The times of earlier answers are kept in the mod's own store, so they stay on the machine that wrote them.
- Times follow the clock of the machine running Claude Code. Subagent turns are ignored.

## Tests

```
claude plugin validate .
claude plugin test .
```

## License

MIT. See [LICENSE](LICENSE).
