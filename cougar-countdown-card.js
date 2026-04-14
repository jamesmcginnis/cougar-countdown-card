/**
 * Cougar Countdown Card
 * Countdown timer card for Home Assistant.
 * https://github.com/jamesmcginnis/cougar-countdown-card
 */

class CougarCountdownCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._interval = null;
    this._rendered = false;
  }

  static getConfigElement() {
    return document.createElement('cougar-countdown-card-editor');
  }

  static getStubConfig() {
    return {
      entity: '',
      show_seconds: true,
      accent_color: '#FF9F0A',
      text_color: '#ffffff',
      card_bg: '#1c1c1e',
      use_glassmorphism: true,
    };
  }

  setConfig(config) {
    this._config = {
      show_seconds: true,
      accent_color: '#FF9F0A',
      text_color: '#ffffff',
      card_bg: '#1c1c1e',
      use_glassmorphism: true,
      ...config,
    };
    if (this._rendered) {
      this._rendered = false;
      this.shadowRoot.innerHTML = '';
    }
  }

  set hass(hass) {
    this._hass = hass;
    if (!this._rendered) {
      this._render();
      this._rendered = true;
    }
    this._update();
  }

  connectedCallback() {
    this._interval = setInterval(() => {
      if (this._hass) this._update();
    }, 500);
  }

  disconnectedCallback() {
    clearInterval(this._interval);
    this._interval = null;
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────

  /**
   * Returns { seconds, state, total } for both native timer.* entities
   * and sensor entities (e.g. sensor.kitchen_next_timer from Google Home /
   * Alexa integrations).
   *
   * Native timer.*:  state = idle | active | paused
   *                  attrs: duration, remaining, finishes_at
   *
   * Sensor timers:   state may be an ISO datetime (fire time),
   *                  a numeric string (remaining seconds),
   *                  or a formatted string like "0:05:00".
   *                  attrs may carry: duration, remaining, status, fire_time, etc.
   */
  _getRemaining() {
    const stateObj = this._hass?.states[this._config?.entity];
    if (!stateObj) return null;

    const state = stateObj.state;
    const attrs = stateObj.attributes;

    // ── Native HA timer entity ───────────────────────────────────────────────
    if (['idle', 'active', 'paused'].includes(state)) {
      const total = this._parseDuration(attrs.duration || '0:00:00');
      if (state === 'idle')   return { seconds: total, state: 'idle',   total };
      if (state === 'paused') return { seconds: this._parseDuration(attrs.remaining || '0:00:00'), state: 'paused', total };
      // active
      if (attrs.finishes_at) {
        return { seconds: Math.max(0, (new Date(attrs.finishes_at) - Date.now()) / 1000), state: 'active', total };
      }
      return { seconds: this._parseDuration(attrs.remaining || '0:00:00'), state: 'active', total };
    }

    // ── Sensor-based timer (Google Home, Alexa, etc.) ────────────────────────

    // Attempt 1 — state is an ISO datetime string (fire time)
    // e.g. "2024-05-01T12:34:56+00:00"
    const asDate = new Date(state);
    if (!isNaN(asDate.getTime()) && state.includes('T')) {
      const remaining = Math.max(0, (asDate - Date.now()) / 1000);
      const total     = this._attrDuration(attrs) || remaining;
      const timerState = remaining <= 0 ? 'idle' : 'active';
      return { seconds: remaining, state: timerState, total };
    }

    // Attempt 2 — attrs.fire_time or attrs.finishes_at is a datetime
    const fireAttr = attrs.fire_time || attrs.finishes_at || attrs.end_time;
    if (fireAttr) {
      const fireDate = new Date(fireAttr);
      if (!isNaN(fireDate.getTime())) {
        const remaining = Math.max(0, (fireDate - Date.now()) / 1000);
        const total     = this._attrDuration(attrs) || remaining;
        const timerState = remaining <= 0 ? 'idle' : 'active';
        return { seconds: remaining, state: timerState, total };
      }
    }

    // Attempt 3 — attrs.remaining is a duration string or seconds value
    if (attrs.remaining != null) {
      const rem   = typeof attrs.remaining === 'number'
        ? attrs.remaining
        : this._parseDuration(String(attrs.remaining));
      const total = this._attrDuration(attrs) || rem;
      const paused = attrs.status === 'paused' || attrs.paused === true;
      return { seconds: rem, state: paused ? 'paused' : (rem > 0 ? 'active' : 'idle'), total };
    }

    // Attempt 4 — state itself is a numeric string (remaining seconds)
    const asNum = parseFloat(state);
    if (!isNaN(asNum)) {
      const total = this._attrDuration(attrs) || asNum;
      return { seconds: Math.max(0, asNum), state: asNum > 0 ? 'active' : 'idle', total };
    }

    // Attempt 5 — state is a duration string like "0:05:00" or "5:00"
    const asDur = this._parseDuration(state);
    if (asDur > 0) {
      const total = this._attrDuration(attrs) || asDur;
      return { seconds: asDur, state: 'active', total };
    }

    // Unavailable / unknown
    return { seconds: 0, state: 'idle', total: 0 };
  }

  /** Try common attribute keys that represent a total duration. */
  _attrDuration(attrs) {
    for (const key of ['duration', 'total_duration', 'original_duration', 'total']) {
      if (attrs[key] != null) {
        const v = typeof attrs[key] === 'number'
          ? attrs[key]
          : this._parseDuration(String(attrs[key]));
        if (v > 0) return v;
      }
    }
    return 0;
  }

  _parseDuration(str) {
    if (!str) return 0;
    // Already a number
    const asNum = parseFloat(str);
    if (!isNaN(asNum) && !str.includes(':')) return asNum;
    // H:MM:SS or M:SS
    const parts = str.split(':').map(Number);
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    if (parts.length === 2) return parts[0] * 60  + parts[1];
    return 0;
  }

  _formatTime(totalSeconds, showSeconds) {
    const s     = Math.max(0, Math.ceil(totalSeconds));
    const hours = Math.floor(s / 3600);
    const mins  = Math.floor((s % 3600) / 60);
    const secs  = s % 60;
    const hh = String(hours).padStart(2, '0');
    const mm = String(mins).padStart(2, '0');
    const ss = String(secs).padStart(2, '0');
    if (hours > 0) return showSeconds ? `${hh}:${mm}:${ss}` : `${hh}:${mm}`;
    return showSeconds ? `${mm}:${ss}` : mm;
  }

  _bgStyle() {
    const cfg = this._config;
    const raw = cfg.card_bg || '#1c1c1e';
    if (raw === '#000000') return { bg: 'transparent', border: 'none', backdrop: 'none' };
    if (cfg.use_glassmorphism) {
      const base      = raw.substring(0, 7);
      const withAlpha = /^#[0-9a-fA-F]{8}$/.test(raw) ? raw : base + 'cc';
      return { bg: withAlpha, border: '1px solid rgba(255,255,255,0.14)', backdrop: 'blur(24px) saturate(180%)' };
    }
    return { bg: raw, border: 'none', backdrop: 'none' };
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  _render() {
    const cfg = this._config;
    const acc = cfg.accent_color || '#FF9F0A';
    const txt = cfg.text_color   || '#ffffff';
    const bg  = this._bgStyle();
    const R   = 100;
    const C   = (2 * Math.PI * R).toFixed(2);

    this.shadowRoot.innerHTML = `
      <style>
        :host { display: block; }
        ha-card { background: transparent; box-shadow: none; border: none; }

        .card {
          background: ${bg.bg};
          backdrop-filter: ${bg.backdrop};
          -webkit-backdrop-filter: ${bg.backdrop};
          border: ${bg.border};
          border-radius: 28px;
          padding: 28px 20px 30px;
          font-family: -apple-system, "SF Pro Display", BlinkMacSystemFont, "Helvetica Neue", sans-serif;
          color: ${txt};
          position: relative;
          overflow: hidden;
          user-select: none;
          -webkit-user-select: none;
          box-sizing: border-box;
        }

        .timer-name {
          text-align: center;
          font-size: 15px;
          font-weight: 500;
          color: ${txt};
          opacity: 0.55;
          letter-spacing: 0.01em;
          margin-bottom: 22px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          padding: 0 12px;
        }

        .ring-wrap {
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .ring-container {
          position: relative;
          width: 220px;
          height: 220px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .ring-svg {
          position: absolute;
          top: 0; left: 0;
          width: 100%; height: 100%;
          pointer-events: none;
          overflow: visible;
        }

        .ring-bg {
          fill: none;
          stroke: rgba(255,255,255,0.08);
          stroke-width: 8;
        }

        .ring-progress {
          fill: none;
          stroke: ${acc};
          stroke-width: 8;
          stroke-linecap: round;
          transform-origin: 50% 50%;
          transform: rotate(-90deg);
          transition: stroke-dashoffset 0.6s cubic-bezier(0.4, 0, 0.2, 1);
          filter: drop-shadow(0 0 6px ${acc}88);
        }

        .time-display {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
          z-index: 1;
          gap: 6px;
          position: relative;
        }

        .time-digits {
          font-size: 58px;
          font-weight: 200;
          letter-spacing: -3px;
          line-height: 1;
          font-variant-numeric: tabular-nums;
          color: ${txt};
          transition: opacity 0.4s ease;
          white-space: nowrap;
        }

        .time-digits.is-paused {
          opacity: 0.45;
          animation: blink 1.6s ease-in-out infinite;
        }

        @keyframes blink {
          0%, 100% { opacity: 0.45; }
          50%       { opacity: 0.75; }
        }

        .state-pill {
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          padding: 4px 12px;
          border-radius: 20px;
          transition: background 0.3s, color 0.3s;
        }
        .state-pill.active { background: ${acc}28; color: ${acc}; }
        .state-pill.paused { background: rgba(255,255,255,0.10); color: rgba(255,255,255,0.4); }
        .state-pill.idle   { background: rgba(255,255,255,0.07); color: rgba(255,255,255,0.3); }
      </style>

      <ha-card>
        <div class="card">
          <div class="timer-name" id="timerName">Timer</div>
          <div class="ring-wrap">
            <div class="ring-container">
              <svg class="ring-svg" viewBox="0 0 220 220">
                <circle class="ring-bg"       cx="110" cy="110" r="${R}"/>
                <circle class="ring-progress" cx="110" cy="110" r="${R}"
                  id="ringProgress"
                  stroke-dasharray="${C}"
                  stroke-dashoffset="0"/>
              </svg>
              <div class="time-display">
                <div class="time-digits" id="timeDigits">--:--</div>
                <div class="state-pill idle" id="statePill">Idle</div>
              </div>
            </div>
          </div>
        </div>
      </ha-card>
    `;
  }

  // ── Update ───────────────────────────────────────────────────────────────────

  _update() {
    if (!this._hass || !this._rendered) return;
    const cfg    = this._config;
    const root   = this.shadowRoot;
    const nameEl = root.getElementById('timerName');
    const timeEl = root.getElementById('timeDigits');
    const pillEl = root.getElementById('statePill');
    const ringEl = root.getElementById('ringProgress');
    if (!timeEl) return;

    const stateObj = cfg?.entity ? this._hass.states[cfg.entity] : null;

    if (!stateObj) {
      if (nameEl) nameEl.textContent = cfg?.entity ? cfg.entity : 'No entity selected';
      if (timeEl) timeEl.textContent = '--:--';
      if (pillEl) { pillEl.className = 'state-pill idle'; pillEl.textContent = 'Idle'; }
      return;
    }

    if (nameEl) nameEl.textContent = stateObj.attributes?.friendly_name || cfg.entity;

    const info = this._getRemaining();
    if (!info) return;

    if (timeEl) {
      timeEl.textContent = this._formatTime(info.seconds, cfg.show_seconds !== false);
      timeEl.classList.toggle('is-paused', info.state === 'paused');
    }

    if (pillEl) {
      pillEl.className = `state-pill ${info.state}`;
      pillEl.textContent = { active: 'Running', paused: 'Paused', idle: 'Idle' }[info.state] || info.state;
    }

    if (ringEl) {
      const C   = 2 * Math.PI * 100;
      const pct = info.total > 0
        ? Math.min(1, Math.max(0, info.seconds / info.total))
        : (info.state === 'idle' ? 1 : 0);
      ringEl.style.strokeDashoffset = (C * (1 - pct)).toFixed(3);
    }
  }

  getCardSize() { return 4; }
}

// ── Editor ────────────────────────────────────────────────────────────────────

class CougarCountdownCardEditor extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._initialized = false;
  }

  set hass(hass) {
    this._hass = hass;
    if (!this._initialized) this._render();
  }

  setConfig(config) {
    this._config = config;
    if (!this._initialized && this._hass) this._render();
    if (this._initialized) this._updateUI();
  }

  _updateConfig(key, value) {
    if (!this._config) return;
    this.dispatchEvent(new CustomEvent('config-changed', {
      detail: { config: { ...this._config, [key]: value } },
      bubbles: true,
      composed: true,
    }));
  }

  _render() {
    if (!this._hass || !this._config) return;
    this._initialized = true;

    const cfg    = this._config;
    const selEnt = cfg.entity || '';

    // Show all entities — user may use timer.*, sensor.*, input_datetime.*, etc.
    const allEntities = Object.keys(this._hass.states).sort();

    this.shadowRoot.innerHTML = `
      <style>
        .container {
          display: flex; flex-direction: column; gap: 20px;
          padding: 12px;
          color: var(--primary-text-color);
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        }
        .section-title {
          font-size: 11px; font-weight: 700; text-transform: uppercase;
          letter-spacing: 0.08em; color: #888; margin-bottom: 4px;
        }
        .card-block {
          background: var(--card-background-color);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 12px; overflow: hidden;
        }

        /* ── Entity picker ── */
        .entity-picker { padding: 12px 16px; display: flex; flex-direction: column; gap: 8px; }
        .hint { font-size: 11px; color: #888; line-height: 1.4; }

        input[type="text"] {
          width: 100%; box-sizing: border-box;
          background: var(--card-background-color);
          color: var(--primary-text-color);
          border: 1px solid rgba(255,255,255,0.12);
          border-radius: 8px; padding: 10px 12px; font-size: 14px;
        }
        input[type="text"]:focus { outline: none; border-color: rgba(255,255,255,0.3); }

        .entity-list {
          max-height: 220px;
          overflow-y: auto;
          -webkit-overflow-scrolling: touch;
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 8px;
          background: var(--card-background-color);
        }
        .entity-list.hidden { display: none; }

        .entity-option {
          padding: 10px 12px;
          font-size: 13px;
          cursor: pointer;
          border-bottom: 1px solid rgba(255,255,255,0.05);
          display: flex; flex-direction: column; gap: 2px;
        }
        .entity-option:last-child { border-bottom: none; }
        .entity-option:hover, .entity-option.selected {
          background: rgba(255,255,255,0.07);
        }
        .entity-option.selected { color: #FF9F0A; }
        .entity-option-id { font-size: 11px; opacity: 0.5; font-family: monospace; }

        /* ── Toggles ── */
        .toggle-list  { display: flex; flex-direction: column; }
        .toggle-item  {
          display: flex; align-items: center; justify-content: space-between;
          padding: 13px 16px; border-bottom: 1px solid rgba(255,255,255,0.06); min-height: 52px;
        }
        .toggle-item:last-child { border-bottom: none; }
        .toggle-label { font-size: 14px; font-weight: 500; flex: 1; padding-right: 12px; }
        .toggle-desc  { font-size: 11px; color: #888; margin-top: 2px; line-height: 1.4; }
        .toggle-switch { position: relative; width: 51px; height: 31px; flex-shrink: 0; }
        .toggle-switch input { opacity: 0; width: 0; height: 0; position: absolute; }
        .toggle-track {
          position: absolute; inset: 0; border-radius: 31px;
          background: rgba(120,120,128,0.32); cursor: pointer;
          transition: background 0.25s ease;
        }
        .toggle-track::after {
          content: ''; position: absolute;
          width: 27px; height: 27px; border-radius: 50%;
          background: #fff; top: 2px; left: 2px;
          box-shadow: 0 2px 6px rgba(0,0,0,0.3);
          transition: transform 0.25s ease;
        }
        .toggle-switch input:checked + .toggle-track { background: #34C759; }
        .toggle-switch input:checked + .toggle-track::after { transform: translateX(20px); }

        /* ── Colour pickers ── */
        .colour-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
        .colour-card {
          border: 1px solid var(--divider-color, rgba(0,0,0,0.12));
          border-radius: 10px; overflow: hidden; cursor: pointer;
          transition: box-shadow 0.15s, border-color 0.15s; position: relative;
        }
        .colour-card:hover {
          box-shadow: 0 2px 10px rgba(0,0,0,0.12);
          border-color: var(--primary-color, #007AFF);
        }
        .colour-swatch { height: 44px; width: 100%; display: block; position: relative; }
        .colour-swatch input[type="color"] {
          position: absolute; inset: 0; width: 100%; height: 100%;
          opacity: 0; cursor: pointer; border: none; padding: 0;
        }
        .colour-swatch-preview { position: absolute; inset: 0; pointer-events: none; }
        .colour-swatch::before {
          content: ''; position: absolute; inset: 0;
          background-image:
            linear-gradient(45deg,  #ccc 25%, transparent 25%),
            linear-gradient(-45deg, #ccc 25%, transparent 25%),
            linear-gradient(45deg,  transparent 75%, #ccc 75%),
            linear-gradient(-45deg, transparent 75%, #ccc 75%);
          background-size: 8px 8px;
          background-position: 0 0, 0 4px, 4px -4px, -4px 0px;
          opacity: 0.3; pointer-events: none;
        }
        .colour-info { padding: 6px 8px 7px; background: var(--card-background-color, #fff); }
        .colour-label { font-size: 11px; font-weight: 700; color: var(--primary-text-color); letter-spacing: 0.02em; margin-bottom: 1px; }
        .colour-desc  { font-size: 10px; color: var(--secondary-text-color, #6b7280); margin-bottom: 4px; line-height: 1.3; }
        .colour-hex-row { display: flex; align-items: center; gap: 4px; }
        .colour-dot { width: 12px; height: 12px; border-radius: 50%; border: 1px solid rgba(0,0,0,0.15); flex-shrink: 0; }
        .colour-hex {
          flex: 1; font-size: 11px; font-family: monospace;
          border: none; background: none;
          color: var(--secondary-text-color, #6b7280);
          padding: 0; width: 0; min-width: 0;
        }
        .colour-hex:focus { outline: none; color: var(--primary-text-color); }
        .colour-edit-icon { opacity: 0; transition: opacity 0.15s; color: var(--secondary-text-color); font-size: 14px; line-height: 1; }
        .colour-card:hover .colour-edit-icon { opacity: 1; }
      </style>

      <div class="container">

        <!-- Entity picker -->
        <div>
          <div class="section-title">Entity</div>
          <div class="card-block">
            <div class="entity-picker">
              <div class="hint">Search for any entity — timer.*, sensor.*, input_datetime.* etc.</div>
              <input type="text" id="entitySearch"
                placeholder="Search entities…"
                autocomplete="off" spellcheck="false"
                value="${selEnt}">
              <div class="entity-list hidden" id="entityList">
                ${allEntities.map(e => {
                  const name = this._hass.states[e]?.attributes?.friendly_name || '';
                  return `<div class="entity-option${e === selEnt ? ' selected' : ''}" data-id="${e}">
                    ${name ? `<span>${name}</span>` : ''}
                    <span class="entity-option-id">${e}</span>
                  </div>`;
                }).join('')}
              </div>
            </div>
          </div>
        </div>

        <!-- Options -->
        <div>
          <div class="section-title">Options</div>
          <div class="card-block">
            <div class="toggle-list">
              <div class="toggle-item">
                <div>
                  <div class="toggle-label">Show Seconds</div>
                  <div class="toggle-desc">Display seconds alongside minutes in the countdown</div>
                </div>
                <label class="toggle-switch">
                  <input type="checkbox" id="show_seconds" ${cfg.show_seconds !== false ? 'checked' : ''}>
                  <span class="toggle-track"></span>
                </label>
              </div>
              <div class="toggle-item">
                <div>
                  <div class="toggle-label">Glassmorphic Background</div>
                  <div class="toggle-desc">Frosted-glass blur effect behind the card</div>
                </div>
                <label class="toggle-switch">
                  <input type="checkbox" id="use_glassmorphism" ${cfg.use_glassmorphism !== false ? 'checked' : ''}>
                  <span class="toggle-track"></span>
                </label>
              </div>
            </div>
          </div>
        </div>

        <!-- Colours -->
        <div>
          <div class="section-title">Colours</div>
          <div class="card-block" style="padding:10px;">
            <div class="colour-grid" id="colour-grid"></div>
          </div>
        </div>

      </div>
    `;

    this._buildColourPickers();
    this._setupListeners();
  }

  _setupListeners() {
    const root       = this.shadowRoot;
    const searchInput = root.getElementById('entitySearch');
    const listEl      = root.getElementById('entityList');

    // Show dropdown on focus
    searchInput.addEventListener('focus', () => {
      this._filterList('');
      listEl.classList.remove('hidden');
    });

    // Filter as user types
    searchInput.addEventListener('input', () => {
      this._filterList(searchInput.value);
      listEl.classList.remove('hidden');
    });

    // Pick an entity from the list
    listEl.addEventListener('mousedown', (e) => {
      const opt = e.target.closest('.entity-option');
      if (!opt) return;
      e.preventDefault(); // prevent blur before click
      const id = opt.dataset.id;
      searchInput.value = id;
      listEl.classList.add('hidden');
      listEl.querySelectorAll('.entity-option').forEach(o => o.classList.toggle('selected', o.dataset.id === id));
      this._updateConfig('entity', id);
    });

    // Hide dropdown on blur
    searchInput.addEventListener('blur', () => {
      setTimeout(() => listEl.classList.add('hidden'), 150);
    });

    root.getElementById('show_seconds').onchange    = (e) => this._updateConfig('show_seconds', e.target.checked);
    root.getElementById('use_glassmorphism').onchange = (e) => this._updateConfig('use_glassmorphism', e.target.checked);
  }

  _filterList(term) {
    const lower = term.toLowerCase();
    this.shadowRoot.querySelectorAll('.entity-option').forEach(opt => {
      const text = opt.textContent.toLowerCase();
      opt.style.display = text.includes(lower) ? '' : 'none';
    });
  }

  _buildColourPickers() {
    const COLOUR_FIELDS = [
      { key: 'accent_color', label: 'Accent / Ring',    desc: 'Progress ring and active state colour',              default: '#FF9F0A', maxlen: 7 },
      { key: 'text_color',   label: 'Text Colour',      desc: 'Time digits and name label colour',                  default: '#ffffff', maxlen: 7 },
      { key: 'card_bg',      label: 'Card Background',  desc: '#000000 = transparent · 8-digit hex for opacity',    default: '#1c1c1e', maxlen: 9 },
    ];

    const grid = this.shadowRoot.getElementById('colour-grid');
    if (!grid) return;

    for (const field of COLOUR_FIELDS) {
      const savedVal  = this._config[field.key] || '';
      const swatchVal = savedVal || field.default;

      const card = document.createElement('div');
      card.className   = 'colour-card';
      card.dataset.key = field.key;
      card.innerHTML = `
        <label class="colour-swatch">
          <div class="colour-swatch-preview" style="background:${swatchVal}"></div>
          <input type="color" value="${/^#[0-9a-fA-F]{6}$/.test(swatchVal) ? swatchVal : swatchVal.substring(0,7)}">
        </label>
        <div class="colour-info">
          <div class="colour-label">${field.label}</div>
          <div class="colour-desc">${field.desc}</div>
          <div class="colour-hex-row">
            <div class="colour-dot" style="background:${swatchVal}"></div>
            <input class="colour-hex" type="text" value="${savedVal}"
              maxlength="${field.maxlen}" placeholder="${field.default}" spellcheck="false">
            <span class="colour-edit-icon">✎</span>
          </div>
        </div>`;

      const nativePicker = card.querySelector('input[type=color]');
      const hexInput     = card.querySelector('.colour-hex');
      const preview      = card.querySelector('.colour-swatch-preview');
      const dot          = card.querySelector('.colour-dot');

      const apply = (val) => {
        preview.style.background = val;
        dot.style.background     = val;
        if (/^#[0-9a-fA-F]{6}$/.test(val)) nativePicker.value = val;
        hexInput.value = val;
        this._updateConfig(field.key, val);
      };

      nativePicker.addEventListener('input',  () => apply(nativePicker.value));
      nativePicker.addEventListener('change', () => apply(nativePicker.value));
      hexInput.addEventListener('input', () => {
        const v = hexInput.value.trim();
        if (/^#[0-9a-fA-F]{6}$/.test(v) || /^#[0-9a-fA-F]{8}$/.test(v)) apply(v);
      });
      hexInput.addEventListener('blur', () => {
        const cur = this._config[field.key] || field.default;
        if (!/^#[0-9a-fA-F]{6,8}$/.test(hexInput.value.trim())) hexInput.value = cur;
      });
      hexInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') hexInput.blur(); });

      grid.appendChild(card);
    }
  }

  _updateUI() {
    const root = this.shadowRoot;
    if (!root || !this._config) return;

    const searchInput = root.getElementById('entitySearch');
    if (searchInput && this._config.entity) searchInput.value = this._config.entity;

    const showSecs = root.getElementById('show_seconds');
    if (showSecs) showSecs.checked = this._config.show_seconds !== false;

    const useGlass = root.getElementById('use_glassmorphism');
    if (useGlass) useGlass.checked = this._config.use_glassmorphism !== false;

    root.querySelectorAll('.colour-card').forEach(card => {
      const key       = card.dataset.key;
      const savedVal  = this._config[key] || '';
      const swatchVal = savedVal || card.querySelector('.colour-hex').placeholder;
      card.querySelector('.colour-swatch-preview').style.background = swatchVal;
      card.querySelector('.colour-dot').style.background            = swatchVal;
      const np = card.querySelector('input[type=color]');
      if (np && /^#[0-9a-fA-F]{6}$/.test(swatchVal)) np.value = swatchVal;
      const hx = card.querySelector('.colour-hex');
      if (hx) hx.value = savedVal;
    });
  }
}

// ── Registration ──────────────────────────────────────────────────────────────

if (!customElements.get('cougar-countdown-card')) {
  customElements.define('cougar-countdown-card', CougarCountdownCard);
}
if (!customElements.get('cougar-countdown-card-editor')) {
  customElements.define('cougar-countdown-card-editor', CougarCountdownCardEditor);
}

window.customCards = window.customCards || [];
if (!window.customCards.some(c => c.type === 'cougar-countdown-card')) {
  window.customCards.push({
    type: 'cougar-countdown-card',
    name: 'Cougar Countdown Card',
    preview: true,
    description: 'A countdown timer card for Home Assistant with animated progress ring and frosted-glass styling.',
  });
}
