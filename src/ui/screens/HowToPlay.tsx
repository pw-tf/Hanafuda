/**
 * The rules, in full.
 *
 * Everything numeric on this screen is read from the active `RuleConfig`, never
 * written into the copy: the two scoring presets disagree on the Brights values
 * and the optional rules change what counts, so a hardcoded "10" here would be
 * wrong for half the players and would rot the first time a preset moved. The
 * same goes for the card lists — they are filtered out of `DECK`, so the deck
 * and the rules screen cannot drift apart.
 *
 * Three tabs rather than one long scroll: the yaku list with its artwork is the
 * part players come back to, and burying it under the turn sequence meant
 * scrolling past what you already know every time.
 */

import { useState } from 'react';
import { CardFace } from '../../art/CardFace';
import {
  CARD_IDS,
  DECK,
  MONTH_NAMES,
  getCard,
  type CardId,
  type CardKind,
} from '../../engine/cards';
import { FIELD_SIZE, HAND_SIZE } from '../../engine/game';
import {
  YAKU_INFO,
  type KoiKoiMultiplierMode,
  type RuleConfig,
  type YakuId,
} from '../../engine/rules';
import { koiMultiplier } from '../../engine/scoring';
import { plural } from '../text';

/** How the active multiplier mode reads in a sentence. */
const KOI_MULTIPLIER_NOTE: Record<KoiKoiMultiplierMode, string> = {
  bga: '+1 for each koi-koi you called, then ×2 if your opponent called at all',
  sum: '+1 to the multiplier for every call, by either player',
  opponentDoubleOnly: '×2 if the losing player ever called it',
};

type Tab = 'basics' | 'yaku' | 'scoring';

const TAB_LABEL: Record<Tab, string> = {
  basics: 'Basics',
  yaku: 'Yaku',
  scoring: 'Scoring',
};

const ids = (kind: CardKind): CardId[] => DECK.filter((c) => c.kind === kind).map((c) => c.id);

const BRIGHTS = ids('hikari');
/** The four brights Shiko and Sanko are drawn from — every bright but the Rain Man. */
const PLAIN_BRIGHTS = BRIGHTS.filter((id) => id !== CARD_IDS.RAIN_MAN);
const TANE = ids('tane');
const KASU = ids('kasu');
const RIBBONS = DECK.filter((c) => c.kind === 'tanzaku');
const RIBBON_IDS = RIBBONS.map((c) => c.id);
const POETRY_RIBBONS = RIBBONS.filter((c) => c.ribbon === 'red-poetry').map((c) => c.id);
const BLUE_RIBBONS = RIBBONS.filter((c) => c.ribbon === 'blue').map((c) => c.id);
const PLAIN_RIBBONS = RIBBONS.filter((c) => c.ribbon === 'red-plain').map((c) => c.id);

/** One card of each kind, for the deck illustration. */
const ONE_OF_EACH = [BRIGHTS, TANE, POETRY_RIBBONS, KASU].flatMap((list) => list.slice(0, 1));

/** Cards left in the draw pile after the deal. */
const DRAW_PILE = DECK.length - HAND_SIZE * 2 - FIELD_SIZE;

const COUNT = {
  brights: BRIGHTS.length,
  tane: TANE.length,
  tanzaku: RIBBONS.length,
  kasu: KASU.length,
};

export function HowToPlay({ rules, onBack }: { rules: RuleConfig; onBack(): void }) {
  const [tab, setTab] = useState<Tab>('basics');

  return (
    <div className="screen screen--howto">
      <header className="topbar">
        <button type="button" className="topbar__back" onClick={onBack} aria-label="Back">
          ‹
        </button>
        <div className="topbar__mid">
          <strong>How to play</strong>
        </div>
        <div className="topbar__score" />
      </header>

      <div className="segmented tabs" role="tablist" aria-label="Rules sections">
        {(Object.keys(TAB_LABEL) as Tab[]).map((id) => (
          <button
            key={id}
            type="button"
            role="tab"
            id={`tab-${id}`}
            aria-selected={tab === id}
            aria-controls={`panel-${id}`}
            className={`segmented__btn ${tab === id ? 'is-on' : ''}`}
            onClick={() => setTab(id)}
          >
            {TAB_LABEL[id]}
          </button>
        ))}
      </div>

      {tab === 'basics' && <Basics rules={rules} />}
      {tab === 'yaku' && <Yaku rules={rules} />}
      {tab === 'scoring' && <Scoring rules={rules} />}
    </div>
  );
}

// ---------------------------------------------------------------- basics

function Basics({ rules }: { rules: RuleConfig }) {
  return (
    <div role="tabpanel" id="panel-basics" aria-labelledby="tab-basics">
      <section className="card">
        <h2>The idea</h2>
        <p className="muted small">
          A {DECK.length}-card flower deck: twelve months, four cards each. You collect cards by matching
          months, and sets of the cards you collect — <em>yaku</em> — are what score. Reach one and
          you choose to stop and bank it, or call koi-koi and play on for more.
        </p>
      </section>

      <section className="card">
        <h2>The deck</h2>
        <p className="muted small">
          Four kinds of card. The kind is what scores — the month only decides what a card can
          capture.
        </p>
        <Combo cards={ONE_OF_EACH} named />
        <dl className="deflist">
          <div>
            <dt>Bright (hikari)</dt>
            <dd>{COUNT.brights}</dd>
          </div>
          <div>
            <dt>Animal (tane)</dt>
            <dd>{COUNT.tane}</dd>
          </div>
          <div>
            <dt>Ribbon (tanzaku)</dt>
            <dd>{COUNT.tanzaku}</dd>
          </div>
          <div>
            <dt>Chaff (kasu)</dt>
            <dd>{COUNT.kasu}</dd>
          </div>
        </dl>
        <p className="note">
          Most months hold one animal or bright, one ribbon and two chaff. Two are irregular:
          November is one of each kind, and December is the Phoenix and three chaff — no animal, no
          ribbon.
        </p>
      </section>

      <section className="card">
        <h2>The deal</h2>
        <ol className="steps">
          <li>{HAND_SIZE} cards to each player, face down.</li>
          <li>{FIELD_SIZE} cards face up to the field between you.</li>
          <li>
            The remaining {DRAW_PILE} become the draw pile. If the field shows all four cards of one
            month, the whole deal is taken back and re-dealt.
          </li>
          <li>
            The dealer leads. Who deals the first round is drawn at random; after that whoever wins
            a round deals the next one, and a round nobody wins leaves the deal where it is.
          </li>
        </ol>
      </section>

      <section className="card">
        <h2>A turn</h2>
        <ol className="steps">
          <li>Play a card from your hand. If a field card shares its month, you take both.</li>
          <li>
            Flip the top card of the draw pile onto the field. It matches the same way, and anything
            it takes is yours too.
          </li>
          <li>
            If your yaku total went up, you choose: koi-koi or shobu. Otherwise the turn passes.
          </li>
          <li>The round ends when both hands are empty.</li>
        </ol>
      </section>

      <section className="card">
        <h2>Matching</h2>
        <p className="muted small">Both the card you play and the card you flip follow this rule.</p>
        <dl className="deflist deflist--wide">
          <div>
            <dt>No field card of that month</dt>
            <dd>It stays on the field</dd>
          </div>
          <div>
            <dt>One</dt>
            <dd>Take both</dd>
          </div>
          <div>
            <dt>Two</dt>
            <dd>Choose which to take</dd>
          </div>
          <div>
            <dt>Three</dt>
            <dd>Take all four</dd>
          </div>
        </dl>
        <p className="note">
          Captured cards are yours for the rest of the round. A card that captures nothing is left
          on the field, where either player can take it later — so a card you cannot use is still a
          decision about what you hand over.
        </p>
      </section>

      <section className="card">
        <h2>Koi-koi or shobu</h2>
        <p className="muted small">
          Complete a yaku — or add to one you already hold — and the round stops for your decision.
        </p>
        <dl className="deflist deflist--wide">
          <div>
            <dt>Shobu (勝負)</dt>
            <dd>Stop. The round ends and you bank what you have</dd>
          </div>
          <div>
            <dt>Koi-koi (来い来い)</dt>
            <dd>Play on for more, and raise the multiplier</dd>
          </div>
        </dl>
        <p className="note">
          Koi-koi is the whole game: your total keeps climbing and every koi-koi called multiplies
          whatever is finally won — but if your opponent scores first they take the round and you
          get nothing for the cards you were building on. Calling it on the last turn can only lose
          points, so a yaku completed with the final card is banked for you automatically.
        </p>
      </section>

      {rules.teyakuEnabled && (
        <section className="card">
          <h2>Hand yaku (teyaku)</h2>
          <p className="muted small">
            Checked once, against the eight cards as dealt. Either one ends the round on the spot
            for {plural(rules.points.teshi, 'point')}, before anybody plays.
          </p>
          <YakuDef id="teshi" points={ptsLabel(rules.points.teshi)} note="All four cards of one month in your dealt hand." />
          <YakuDef
            id="kuttsuki"
            points={ptsLabel(rules.points.kuttsuki)}
            note="Four pairs — four months, two cards of each."
          />
          <p className="note">
            Hand yaku are paid as dealt: no seven-point doubling, no koi-koi multiplier. If both
            players are dealt one the round is a draw — nobody scores, and the deal does not move.
            Switch them off in Settings.
          </p>
        </section>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- yaku

function Yaku({ rules }: { rules: RuleConfig }) {
  const p = rules.points;

  return (
    <div role="tabpanel" id="panel-yaku" aria-labelledby="tab-yaku">
      <section className="card">
        <h2>How yaku score</h2>
        <p className="muted small">
          Every yaku you complete adds its points together — except the Brights, where only the
          single highest one counts. Points below are the {rules.shortLabel} table; the other preset
          is a tap away in Settings.
        </p>
      </section>

      <section className="card">
        <h2>Brights · 光</h2>
        <p className="muted small">
          {COUNT.brights} bright cards in the deck. These four yaku are mutually exclusive — reach a
          higher one and it replaces the lower, it does not stack.
        </p>
        <YakuDef
          id="goko"
          points={ptsLabel(p.goko)}
          note="All five brights — every one in the deck."
          cards={BRIGHTS}
          named
        />
        <YakuDef
          id="shiko"
          points={ptsLabel(p.shiko)}
          note="Four brights with no Rain Man — which means exactly these four."
          cards={PLAIN_BRIGHTS}
        />
        <YakuDef
          id="ame-shiko"
          points={ptsLabel(p.ameShiko)}
          note="Four brights where one of them is the Rain Man: the Rain Man plus any three of the other four."
          cards={[CARD_IDS.RAIN_MAN]}
        />
        <YakuDef
          id="sanko"
          points={ptsLabel(p.sanko)}
          note="Any three of the four brights above — again, the Rain Man cannot be one of them."
          cards={PLAIN_BRIGHTS}
        />
        <p className="note">
          The one to remember: <strong>three brights including the Rain Man scores nothing</strong>.
          It is not Sanko. Once a fourth bright arrives the Rain Man downgrades Shiko to Ame-Shiko
          rather than cancelling it.
        </p>
      </section>

      <section className="card">
        <h2>Named sets</h2>
        <p className="muted small">
          Specific cards, regardless of how many others you hold. All three stack with each other
          and with everything else.
        </p>
        <YakuDef
          id="ino-shika-cho"
          points={ptsLabel(p.inoShikaCho)}
          note="The Boar of July, the Deer of October and the Butterflies of June — three animals that name themselves."
          cards={[CARD_IDS.BOAR, CARD_IDS.DEER, CARD_IDS.BUTTERFLIES]}
          named
        />
        <YakuDef
          id="hanami-zake"
          points={ptsLabel(p.hanamiZake)}
          note="The March Camp Curtain with the September Sake Cup — a drink under the cherry blossom."
          cards={[CARD_IDS.CURTAIN, CARD_IDS.SAKE_CUP]}
          named
        />
        <YakuDef
          id="tsukimi-zake"
          points={ptsLabel(p.tsukimiZake)}
          note="The August Full Moon with the same Sake Cup — a drink under the moon."
          cards={[CARD_IDS.MOON, CARD_IDS.SAKE_CUP]}
          named
        />
        <p className="note">
          The Sake Cup serves both cups: Curtain + Moon + Cup scores Flower Viewing{' '}
          <em>and</em> Moon Viewing, {p.hanamiZake + p.tsukimiZake} points, on top of whatever the
          Curtain and Moon are already worth as brights.
        </p>
      </section>

      <section className="card">
        <h2>Ribbons · 短冊</h2>
        <p className="muted small">
          {COUNT.tanzaku} ribbons in the deck: {POETRY_RIBBONS.length} red with poetry written on
          them, {BLUE_RIBBONS.length} blue, and {PLAIN_RIBBONS.length} plain red.
        </p>
        <YakuDef
          id="akatan"
          points={ptsLabel(p.akatan)}
          note="All three poetry ribbons — January, February, March."
          cards={POETRY_RIBBONS}
          named
        />
        <YakuDef
          id="aotan"
          points={ptsLabel(p.aotan)}
          note="All three blue ribbons — June, September, October."
          cards={BLUE_RIBBONS}
          named
        />
        <p className="muted small">The four plain ribbons belong to no colour yaku:</p>
        <Combo cards={PLAIN_RIBBONS} named />
        <p className="note">
          Coloured ribbons still count toward the plain Ribbons yaku below. Holding all six scores
          Red Poetry {p.akatan} + Blue {p.aotan} + Ribbons{' '}
          {p.tanzakuBase + (6 - rules.tanzakuThreshold)} ={' '}
          {p.akatan + p.aotan + p.tanzakuBase + (6 - rules.tanzakuThreshold)}.
        </p>
      </section>

      <section className="card">
        <h2>Counting yaku</h2>
        <p className="muted small">
          Reach the count and it scores; every card past it adds one more point. These three run
          alongside everything above — the same card can pay twice.
        </p>

        <YakuDef
          id="tane"
          points={countLabel(p.taneBase)}
          note={`Any ${rules.taneThreshold} of the ${COUNT.tane} animals. A sixth animal makes it ${
            p.taneBase + 1
          }, a seventh ${p.taneBase + 2}, and so on.`}
          cards={TANE}
        />
        <YakuDef
          id="tanzaku"
          points={countLabel(p.tanzakuBase)}
          note={`Any ${rules.tanzakuThreshold} of the ${COUNT.tanzaku} ribbons, of any colour.`}
          cards={RIBBON_IDS}
        />
        <YakuDef
          id="kasu"
          points={countLabel(p.kasuBase)}
          note={`Any ${rules.kasuThreshold} of the ${COUNT.kasu} chaff. There are more of them than anything else, which makes this the quiet way to a score.`}
          cards={KASU.slice(0, 6)}
        />
        {rules.sakeCupMode === 'tane-and-kasu' && (
          <p className="note">
            Your Sake Cup rule is set to <strong>animal + chaff</strong>: the cup counts toward the
            chaff total as well, while still being an animal and still serving both drinking yaku.
          </p>
        )}
      </section>

      <section className="card">
        <h2>Month cards · 月札</h2>
        <p className="muted small">
          Optional, and {rules.tsukiFudaEnabled ? 'currently on' : 'off by default'} — the point
          value is a house rule with weak sourcing. Toggle it in Settings.
        </p>
        <YakuDef
          id="tsuki-fuda"
          points={ptsLabel(p.tsukiFuda)}
          note="All four cards of the round's own month — round 1 is January, round 2 February, and so on round the year."
        />
      </section>
    </div>
  );
}

// ---------------------------------------------------------------- scoring

function Scoring({ rules }: { rules: RuleConfig }) {
  return (
    <div role="tabpanel" id="panel-scoring" aria-labelledby="tab-scoring">
      <section className="card">
        <h2>What a round pays</h2>
        <p className="muted small">
          Only the player who calls shobu scores, and they score everything they hold at that
          moment.
        </p>
        <p className="formula">
          <code>
            base × ({rules.sevenPointThreshold}+ ? ×{rules.sevenPointMultiplier} : ×1) × koi-koi
          </code>
        </p>
        <dl className="deflist deflist--wide">
          <div>
            <dt>Base</dt>
            <dd>Your yaku added up</dd>
          </div>
          <div>
            <dt>{rules.sevenPointThreshold} or more</dt>
            <dd>The whole total ×{rules.sevenPointMultiplier}</dd>
          </div>
          <div>
            <dt>Koi-koi</dt>
            <dd>{KOI_MULTIPLIER_NOTE[rules.koiKoiMultiplierMode]}</dd>
          </div>
        </dl>
        <p className="note">
          The {rules.sevenPointThreshold}-point test reads the raw yaku total, before any multiplier
          — so a base of {rules.sevenPointThreshold - 1} doubled by a koi-koi is still not enough to
          trigger it.
        </p>
      </section>

      <section className="card">
        <h2>Worked example</h2>
        <p className="muted small">
          You hold the Boar, the Deer and the Butterflies, plus three more animals — six animals in
          all — and you called koi-koi once earlier in the round.
        </p>
        <dl className="deflist">
          <div>
            <dt>Boar, Deer, Butterfly</dt>
            <dd>{rules.points.inoShikaCho}</dd>
          </div>
          <div>
            <dt>Animals (6, one past {rules.taneThreshold})</dt>
            <dd>{rules.points.taneBase + 1}</dd>
          </div>
          <div>
            <dt>Base</dt>
            <dd>{exampleBase(rules)}</dd>
          </div>
          <div>
            <dt>
              {exampleBase(rules) >= rules.sevenPointThreshold
                ? `${rules.sevenPointThreshold}+, so ×${rules.sevenPointMultiplier}`
                : `Under ${rules.sevenPointThreshold}, so ×1`}
            </dt>
            <dd>{exampleBase(rules) * exampleSeven(rules)}</dd>
          </div>
          <div>
            <dt>
              {exampleKoi(rules) > 1
                ? `Your koi-koi, ×${exampleKoi(rules)}`
                : 'Your own koi-koi does not multiply, ×1'}
            </dt>
            <dd>{exampleBase(rules) * exampleSeven(rules) * exampleKoi(rules)}</dd>
          </div>
        </dl>
      </section>

      <section className="card">
        <h2>How a round ends</h2>
        <dl className="deflist deflist--wide">
          <div>
            <dt>Shobu</dt>
            <dd>The caller banks their total and the round is over</dd>
          </div>
          <div>
            <dt>Opponent scores after your koi-koi</dt>
            <dd>They take the round; your cards score nothing</dd>
          </div>
          <div>
            <dt>Both hands empty, nobody called</dt>
            <dd>
              {rules.drawRule === 'dealer-1'
                ? 'The dealer takes 1 — oya-ken, the dealer’s privilege'
                : 'Nobody scores the round'}
            </dd>
          </div>
          {rules.teyakuEnabled && (
            <div>
              <dt>Hand yaku at the deal</dt>
              <dd>Scored immediately and the round ends unplayed; both dealt one is a draw</dd>
            </div>
          )}
        </dl>
      </section>

      <section className="card">
        <h2>The match</h2>
        <p className="muted small">
          {plural(rules.rounds, 'round')}, the winner of each one dealing the next. Round scores add
          up and the higher total takes the match. Everything on this screen — the point table, the
          optional rules, the match length — is in Settings, and changes apply to the next game you
          start.
        </p>
        <dl className="deflist">
          <div>
            <dt>Point table</dt>
            <dd>{rules.shortLabel}</dd>
          </div>
          <div>
            <dt>Rounds</dt>
            <dd>{rules.rounds}</dd>
          </div>
          <div>
            <dt>Hand yaku</dt>
            <dd>{rules.teyakuEnabled ? 'On' : 'Off'}</dd>
          </div>
          <div>
            <dt>Month cards</dt>
            <dd>{rules.tsukiFudaEnabled ? 'On' : 'Off'}</dd>
          </div>
          <div>
            <dt>Sake cup</dt>
            <dd>{rules.sakeCupMode === 'tane-and-kasu' ? 'Animal + chaff' : 'Animal only'}</dd>
          </div>
        </dl>
        <p className="note">
          Koi-Koi has no single canonical scoring table — published sources genuinely disagree,
          most visibly on the Brights. Both tables ship here rather than one being called correct.
        </p>
      </section>
    </div>
  );
}

// ---------------------------------------------------------------- pieces

/** One yaku: name, points, what it takes, and the cards themselves. */
function YakuDef({
  id,
  points,
  note,
  cards,
  named,
}: {
  id: YakuId;
  points: string;
  note: string;
  cards?: readonly CardId[];
  named?: boolean;
}) {
  const info = YAKU_INFO[id];
  return (
    <article className="yakudef">
      <header className="yakudef__head">
        <h3>
          {info.name}
          <em>{info.nameJa}</em>
        </h3>
        <span className="yakudef__pts">{points}</span>
      </header>
      <p className="yakudef__note">{note}</p>
      {cards && cards.length > 0 && <Combo cards={cards} named={named} />}
    </article>
  );
}

/**
 * A row of card faces, optionally captioned.
 *
 * The caption leads with the month because several cards share a name — the
 * three blue ribbons are all "Blue Ribbon", and which months they belong to is
 * the part that matters when you are hunting for them on the field.
 */
function Combo({ cards, named }: { cards: readonly CardId[]; named?: boolean }) {
  return (
    <div className={named ? 'combo combo--named' : 'combo'}>
      {cards.map((id) => {
        const card = getCard(id);
        return (
          <figure key={id} className="combo__card">
            <CardFace id={id} width={46} />
            {named && (
              <figcaption>
                <span className="combo__month">{MONTH_NAMES[card.month].slice(0, 3)}</span>
                {card.name}
              </figcaption>
            )}
          </figure>
        );
      })}
    </div>
  );
}

const ptsLabel = (n: number) => plural(n, 'pt');
const countLabel = (base: number) => `${plural(base, 'pt')} +1 each extra`;

/** The worked example: Ino-Shika-Cho plus a sixth animal. */
const exampleBase = (rules: RuleConfig) => rules.points.inoShikaCho + rules.points.taneBase + 1;
const exampleSeven = (rules: RuleConfig) =>
  exampleBase(rules) >= rules.sevenPointThreshold ? rules.sevenPointMultiplier : 1;
/**
 * The example's one koi-koi, priced by the engine's own function rather than a
 * transcription of it — a worked example that disagrees with the scorer is
 * worse than no example.
 */
const exampleKoi = (rules: RuleConfig) =>
  koiMultiplier({ byWinner: 1, byLoser: 0 }, rules.koiKoiMultiplierMode);
