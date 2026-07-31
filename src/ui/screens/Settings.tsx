import { useState } from 'react';
import {
  GAMEDESIGN_RULES,
  STANDARD_RULES,
  YAKU_INFO,
  type RuleConfig,
  type SakeCupMode,
  type KoiKoiMultiplierMode,
  type DrawRule,
} from '../../engine/rules';
import type { Preferences } from '../preferences';

type Tab = 'rules' | 'customise';

const TAB_LABEL: Record<Tab, string> = {
  rules: 'Rules',
  customise: 'Customise',
};

/**
 * Everything the player can change, in two tabs.
 *
 * Rules are what the engine reads; Customise is what the app looks like. They
 * are separated because they behave differently — a rule change alters how a
 * game is scored and only applies to the next one, while a look change is
 * immediate and remembered between visits.
 *
 * The two scoring presets exist because published sources genuinely disagree on
 * the Brights values; see the README.
 */
export function Settings({
  rules,
  onChange,
  preferences,
  onPreferences,
  onBack,
}: {
  rules: RuleConfig;
  onChange(next: RuleConfig): void;
  preferences: Preferences;
  onPreferences(next: Preferences): void;
  onBack(): void;
}) {
  const [tab, setTab] = useState<Tab>('rules');
  const set = <K extends keyof RuleConfig>(key: K, value: RuleConfig[K]) =>
    onChange({ ...rules, [key]: value });

  const usePreset = (preset: RuleConfig) =>
    onChange({
      ...preset,
      // Keep the player's optional-rule choices when swapping point tables.
      teyakuEnabled: rules.teyakuEnabled,
      tsukiFudaEnabled: rules.tsukiFudaEnabled,
      sakeCupMode: rules.sakeCupMode,
      koiKoiMultiplierMode: rules.koiKoiMultiplierMode,
      drawRule: rules.drawRule,
      rounds: rules.rounds,
    });

  const brights: Array<[string, number]> = [
    [YAKU_INFO.goko.name, rules.points.goko],
    [YAKU_INFO.shiko.name, rules.points.shiko],
    [YAKU_INFO['ame-shiko'].name, rules.points.ameShiko],
    [YAKU_INFO.sanko.name, rules.points.sanko],
  ];

  return (
    <div className="screen screen--settings">
      <header className="topbar">
        <button type="button" className="topbar__back" onClick={onBack} aria-label="Back">
          ‹
        </button>
        <div className="topbar__mid">
          <strong>Settings</strong>
        </div>
        <div className="topbar__score" />
      </header>

      <div className="segmented tabs" role="tablist" aria-label="Settings sections">
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

      {tab === 'customise' && (
        <div role="tabpanel" id="panel-customise" aria-labelledby="tab-customise">
          <section className="card">
            <h2>Background</h2>

            <figure className="preview">
              <img
                src={`${import.meta.env.BASE_URL}backgrounds/blossom.webp`}
                alt="Plum blossom over a deep red sun, on near-black paper"
                width={120}
                height={160}
                loading="lazy"
                decoding="async"
              />
              <figcaption className="menu__hint">Blossom</figcaption>
            </figure>

            <Toggle
              label="Show the background"
              hint="Remembered on this device."
              checked={preferences.background}
              onChange={(v) => onPreferences({ ...preferences, background: v })}
            />
          </section>
        </div>
      )}

      {tab === 'rules' && (
        <div role="tabpanel" id="panel-rules" aria-labelledby="tab-rules">
          <section className="card">
            <h2>Scoring table</h2>
            <p className="muted small">
              Sources disagree on the Brights values. Both published tables ship here; everything
              else is identical between them.
            </p>
            <div className="segmented" role="group" aria-label="Scoring preset">
              {[STANDARD_RULES, GAMEDESIGN_RULES].map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  className={`segmented__btn ${rules.id === preset.id ? 'is-on' : ''}`}
                  onClick={() => usePreset(preset)}
                  aria-pressed={rules.id === preset.id}
                >
                  {preset.shortLabel}
                </button>
              ))}
            </div>
            <dl className="deflist">
              {brights.map(([name, pts]) => (
                <div key={name}>
                  <dt>{name}</dt>
                  <dd>{pts}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section className="card">
            <h2>Optional rules</h2>

            <Toggle
              label="Hand yaku (teyaku)"
              hint="Teshi and Kuttsuki score 6 at the deal and end the round immediately. Both players dealt one is a draw."
              checked={rules.teyakuEnabled}
              onChange={(v) => set('teyakuEnabled', v)}
            />

            <Toggle
              label="Month cards (tsuki-fuda)"
              hint="4 points for all four cards of the round's month. Weakly sourced, so off by default."
              checked={rules.tsukiFudaEnabled}
              onChange={(v) => set('tsukiFudaEnabled', v)}
            />

            <Choice<SakeCupMode>
              label="Sake cup counts as"
              hint="Whether the September cup also adds to your chaff total."
              value={rules.sakeCupMode}
              options={[
                ['tane-only', 'Animal only'],
                ['tane-and-kasu', 'Animal + chaff'],
              ]}
              onChange={(v) => set('sakeCupMode', v)}
            />

            <Choice<KoiKoiMultiplierMode>
              label="Koi-Koi multiplier"
              hint="Standard: +1 for each koi-koi you called, then ×2 if your opponent called at all. Sum: +1 per call by either player. Opponent only: ×2 if they called it."
              value={rules.koiKoiMultiplierMode}
              options={[
                ['bga', 'Standard'],
                ['sum', 'Sum of calls'],
                ['opponentDoubleOnly', 'Opponent only'],
              ]}
              onChange={(v) => set('koiKoiMultiplierMode', v)}
            />

            <Choice<DrawRule>
              label="Nobody scores"
              hint="When both hands empty and no one called the round. Oya-ken, the dealer's privilege, gives the dealer a consolation point."
              value={rules.drawRule}
              options={[
                ['no-score', 'No score'],
                ['dealer-1', 'Dealer takes 1'],
              ]}
              onChange={(v) => set('drawRule', v)}
            />

            <Choice<number>
              label="Match length"
              hint="Rounds per match. The winner of each round deals the next."
              value={rules.rounds}
              options={[
                [1, '1'],
                [3, '3'],
                [6, '6'],
                [12, '12'],
              ]}
              onChange={(v) => set('rounds', v)}
            />
          </section>

          <section className="card">
            <h2>Multipliers</h2>
            <p className="muted small">
              A round total is <code>base × ({rules.sevenPointThreshold}+ ? ×
              {rules.sevenPointMultiplier} : ×1) × koi-koi</code>. The threshold is tested against
              the raw yaku total, before any multiplier.
            </p>
          </section>
        </div>
      )}
    </div>
  );
}

function Toggle({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint: string;
  checked: boolean;
  onChange(next: boolean): void;
}) {
  return (
    <div className="opt">
      <label className="opt__row">
        <span className="opt__label">{label}</span>
        <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
        <span className="opt__switch" aria-hidden="true" />
      </label>
      <p className="menu__hint">{hint}</p>
    </div>
  );
}

function Choice<T extends string | number>({
  label,
  hint,
  value,
  options,
  onChange,
}: {
  label: string;
  hint: string;
  value: T;
  options: Array<[T, string]>;
  onChange(next: T): void;
}) {
  return (
    <div className="opt">
      <span className="opt__label">{label}</span>
      <div className="segmented segmented--sm" role="group" aria-label={label}>
        {options.map(([val, text]) => (
          <button
            key={String(val)}
            type="button"
            className={`segmented__btn ${value === val ? 'is-on' : ''}`}
            onClick={() => onChange(val)}
            aria-pressed={value === val}
          >
            {text}
          </button>
        ))}
      </div>
      <p className="menu__hint">{hint}</p>
    </div>
  );
}
