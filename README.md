# Hanafuda Koi-Koi

### ▶︎ Play: **https://pw-tf.github.io/Hanafuda/**

A vertical, mobile-first [Koi-Koi](https://en.wikipedia.org/wiki/Koi-Koi) game.
Play the computer, pass and play on one device, or play a friend over WebRTC
using a room code. No backend, no tracking, nothing to install
— open the link on your phone and play.

On iOS or Android you can **Add to Home Screen** for a full-screen, portrait
app icon; the manifest is already set up for it.

<details>
<summary>Running it locally</summary>

```sh
npm install
npm run dev      # http://localhost:5173
npm test         # 123 tests
npm run build    # typecheck + production build
```

Open `#/gallery` in the running app to see all 48 card faces with their names
and categories.
</details>

## Deployment

Pushing to `main` builds and publishes to GitHub Pages via
`.github/workflows/deploy.yml`. It runs the tests first, so a red suite blocks
the deploy.

**One-time setup**, neither of which a workflow can do for itself:

1. **Settings → Pages → Source: GitHub Actions.** Ignore the "Jekyll" and
   "Static HTML" starter cards that appear afterwards — the workflow already
   exists, and clicking one would create a second, conflicting workflow.
2. **Settings → Environments → `github-pages` → Deployment branches and tags:
   allow `main`.** Enabling Pages creates a `github-pages` environment whose
   branch policy permits only the repository's default branch at that moment.
   If the default branch was something else when Pages was switched on, the
   build succeeds and the deploy is rejected with:

   > Branch "main" is not allowed to deploy to github-pages due to environment
   > protection rules.

   Setting **Settings → General → Default branch** to `main` is worth doing
   too, but the stored branch policy does not always follow, so check the
   environment rule directly.

Routing is hash-based (`#/gallery`, `#/settings`), so no SPA rewrite rules or
`404.html` fallback are needed, and the app works from any subdirectory. The
asset base path comes from `BASE_PATH`, which the workflow sets to the
repository name; for a root-hosted deploy just leave it unset.

---

## Scoring: which rules?

**Koi-Koi has no single canonical scoring table.** Published sources genuinely
disagree — most visibly on the Brights yaku, where Wikipedia and Board Game
Arena give Goko 10 while gamedesign.jp gives 15. Rather than pick one and call
it correct, both ship as presets and every value is read from a typed
`RuleConfig`; no point value is hardcoded anywhere else in the codebase.

Brights yaku are **mutually exclusive** — only the highest scores. Everything
else stacks.

| Yaku | | Standard *(default)* | gamedesign.jp |
|---|---|---|---|
| Goko — 5 brights | 五光 | 10 | 15 |
| Shiko — 4 brights, no Rain Man | 四光 | 8 | 10 |
| Ame-Shiko — 4 brights incl. Rain Man | 雨四光 | 7 | 8 |
| Sanko — 3 brights, no Rain Man | 三光 | 5 | 6 |
| Ino-Shika-Cho — boar + deer + butterflies | 猪鹿蝶 | 5 | 5 |
| Hanami-zake — Curtain + Sake Cup | 花見で一杯 | 5 | 5 |
| Tsukimi-zake — Moon + Sake Cup | 月見で一杯 | 5 | 5 |
| Akatan — the 3 poetry ribbons | 赤短 | 5 | 5 |
| Aotan — the 3 blue ribbons | 青短 | 5 | 5 |
| Tane — 5 animals | タネ | 1 (+1 each extra) | same |
| Tanzaku — 5 ribbons | 短冊 | 1 (+1 each extra) | same |
| Kasu — 10 chaff | カス | 1 (+1 each extra) | same |

Two cases worth stating explicitly, because they are the usual source of bugs:

- **Three brights including the Rain Man scores nothing.** It is not Sanko.
  Once a fourth bright is present the Rain Man downgrades Shiko to Ame-Shiko
  rather than cancelling it.
- **Akatan and Aotan also feed the plain Tanzaku count.** Holding all six
  coloured ribbons scores Akatan 5 + Aotan 5 + Tanzaku 2 = 12.

### Multipliers

```
final = base × (base >= 7 ? ×2 : ×1) × koi-koi multiplier
```

The seven-point test reads the **raw** yaku total, never a partially
multiplied one. The koi-koi multiplier defaults to `1 + every koi-koi called
this round by either player`, which matches Board Game Arena's documented
default (+1 per koi-koi) and also expresses the "your opponent called koi-koi,
so you score double" rule with a single formula. An `opponentDoubleOnly` mode
is available in Settings.

### Optional rules

All are toggleable in Settings.

| Rule | Default | Behaviour |
|---|---|---|
| Teyaku (hand yaku) | **on** | Teshi (4 of one month) and Kuttsuki (4 pairs) score 6 at the deal and end the round |
| Sake cup counts as | Animal only | Or animal **and** chaff, affecting the Kasu count |
| Tsuki-fuda (month cards) | **off** | 4 points for all four cards of the round's month. Off by default — the value is a house rule with weak sourcing |
| Match length | 12 rounds | Dealer alternates each round |
| Nobody scores | No score | Or the dealer takes 6 |

---

## The deck

48 cards: **5 bright, 9 animal, 10 ribbon, 24 chaff**, twelve months of four.
Two months are irregular and are where transcription errors usually creep in:

- **November (Willow)** — one of each kind: Rain Man (bright), Swallow
  (animal), a plain ribbon, and the Lightning chaff.
- **December (Paulownia)** — the Phoenix and *three* chaff; no animal, no ribbon.

`src/engine/cards.ts` is the single source of truth, and
`src/engine/__tests__/cards.test.ts` asserts every structural invariant
(category totals, per-month counts, ribbon colours, both irregular months), so
an accidental edit fails the suite instead of quietly corrupting scoring.

### Card artwork

The 48 card faces are **Louie Mantia, Jr.'s** hanafuda deck, from Wikimedia
Commons, used unmodified under
[CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/). They live in
`public/cards/<cardId>.svg`; `public/cards/CREDITS.json` records the original
Commons filename behind every card, and [`NOTICE.md`](NOTICE.md) sets out what
the licence asks of you if you fork or redistribute this.

They are rendered as `<img>`, not inlined, and that is deliberate: every file
declares the same element ids (`clip-path`, `Paper_Backing`, …) and the same
CSS class names (`.cls-1`, `.cls-2`, …) but with different colours per card.
Inlined into one document, each card's `<style>` block would repaint every
other card and `url(#clip-path)` would resolve to whichever element came
first. As separate `<img>` documents none of that can happen, and the browser
lazy-loads and caches them for free.

The card *back* is this project's own work, since the Commons set is faces
only.

---

## Architecture

```
src/engine/   pure, serializable, framework-free game logic
  cards.ts      the 48-card deck
  rules.ts      RuleConfig + the two presets
  yaku.ts       yaku evaluation
  scoring.ts    multiplier arithmetic, in one place
  game.ts       turn/round/match state machine
  rng.ts        seeded mulberry32
src/ai/       easy (random), normal (greedy), hard (determinized Monte Carlo)
src/art/      card renderer + palette (faces are assets in public/cards/)
src/net/      room codes, wire protocol, Trystero WebRTC wrapper
src/ui/       portrait-first React screens
```

The engine is pure: `applyMove` never mutates its input and a `GameState` is
plain JSON, which is what makes the network layer and the search AI possible
without a second implementation. The AI plays through the same
`legalMoves`/`applyMove` API as a human, so it cannot make an illegal move.

### The table

Portrait-first, and laid out so the field never loses room:

- **Capture piles are collapsed** into a fixed-height summary per player —
  category counts and current points — opening a sheet with the full pile and
  yaku progress. They used to be live piles that grew with every capture and
  squeezed the field smaller each turn; it lost half its height in four turns.
- **Your hand is fanned** into an arc. Slide across it (finger or cursor) to
  bring each card forward without committing, then tap to pull one out onto
  the table. A tap is told from a slide by distance travelled, so browsing
  never plays a card by accident.
- Cards that can take something wear a quiet gold rim; the forward card shows
  its exact match count. If it can take nothing, the table itself becomes the
  target and tapping it discards.
- The fan's geometry is solved rather than tuned: rotating about a pivot below
  the card swings the outer cards sideways, so `fanLayout()` measures the true
  extent and scales the whole fan down until it fits the container. It stays
  on screen at any hand size and any phone width.

### Matching rules

Playing a card, and flipping the deck card, both follow the same rule:

| Field cards of that month | Result |
|---|---|
| 0 | the card stays on the field |
| 1 | capture both |
| 2 | the player chooses which to take |
| 3 | capture all four |

### AI

Measured over full matches with seats alternated:

| Matchup | Result | Points |
|---|---|---|
| Normal vs Easy | 89W–11L over 100 matches | 2733–623 |
| Hard vs Easy | 35W–5L over 40 matches | 2677–230 |
| Hard vs Normal | 23W–16L–1D over 40 matches | 1075–520 |

Hard's slowest move in that run was 174 ms (p95 90 ms). It samples concrete
assignments of the unseen cards consistent with what it has observed, plays
each out, and averages — it does not read the opponent's hand.

### Multiplayer

Trystero over public relays: signalling only, then a direct end-to-end
encrypted WebRTC data channel. The room password is derived from the room
code, so only someone holding the code can complete the handshake.

The connection is **host-authoritative**: the host owns the one true state and
broadcasts snapshots; the guest sends intents and renders what it is given.
The host validates every intent against `legalMoves` before applying it, so a
modified guest client cannot make the engine break the rules. Snapshots carry
a monotonic sequence number, so an out-of-order delivery is discarded.

Room codes are 6 characters from an alphabet with `0/O/1/I` removed, so a code
read aloud round-trips reliably.

> **Not verified live.** The sandbox this was built in blocks outbound
> WebSockets to every public relay, so the real relay handshake could not be
> exercised end to end. Everything up to that point was verified — room code
> generation, both peers opening a room, the correct relay URLs being dialled,
> and graceful degradation to the "still looking for the other player" state —
> and the sync logic itself is covered by tests that replicate a full round
> between a simulated host and guest. **The live handshake needs a real
> network to confirm.** If one relay type is blocked, both players can switch
> to the other in the lobby.

---

## Testing

`npm test` — 123 tests, ~25 s.

- **Deck structure** — all invariants listed above.
- **Yaku truth table** — every yaku at its threshold and one below; brights
  exclusivity; three-brights-with-Rain-Man scoring zero; Akatan + Aotan +
  Tanzaku stacking to 12; both sake-cup modes; both presets.
- **Scoring** — the ≥7 doubling, both koi-koi modes, and explicitly that the
  threshold tests the raw base (base 4 with a ×2 koi multiplier is 8, not 16).
- **Flow** — all four match counts on both the hand play and the deck flip,
  redeal on a four-of-a-month field, teyaku, every round-end condition.
- **Invariants** — 10,000 random matches (120,000 rounds), asserting at
  *every step* that all 48 cards are in exactly one place, that the field
  never holds four of a month, that no state is mutated, and that match
  totals equal the sum of the rounds.
- **Network** — room-code handling, wire round-trips, host-authoritative
  rejection of out-of-turn and illegal intents, and a guest mirroring a host
  exactly across a full round.

---

## Sources

- [Koi-Koi — Wikipedia](https://en.wikipedia.org/wiki/Koi-Koi)
- [Gamehelpkoikoi — Board Game Arena](https://en.boardgamearena.com/doc/Gamehelpkoikoi)
- [Koi-Koi — Fuda Wiki](https://fudawiki.org/en/hanafuda/games/koi-koi)
- [How to play Hanafuda (Koi Koi) — gamedesign.jp](https://www.gamedesign.jp/flash/hanafuda/rule_e.html)
- [How to Play Koi-Koi — Hanafuda Legends](https://www.hanafudalegends.com/how-to-play)
- [Hanafuda — Wikipedia](https://en.wikipedia.org/wiki/Hanafuda)
