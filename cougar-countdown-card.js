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
      show_name: true,
      custom_name: '',
      display_style: 'ring',
      digits_align: 'center',
      accent_color: '#FF9F0A',
      text_color: '#ffffff',
      card_bg: '#1c1c1e',
      use_glassmorphism: true,
    };
  }

  setConfig(config) {
    this._config = {
      show_name: true,
      custom_name: '',
      display_style: 'ring',
      digits_align: 'center',
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

  _getRemaining() {
    const stateObj = this._hass?.states[this._config?.entity];
    if (!stateObj) return null;
    const state = stateObj.state;
    const attrs = stateObj.attributes;

    // ── Alexa Media Player: derive accurate remaining + total from sorted_active
    if (attrs.sorted_active != null) {
      try {
        const raw = typeof attrs.sorted_active === 'string'
          ? JSON.parse(attrs.sorted_active)
          : attrs.sorted_active;
        // sorted_active is an array of [key, timerData] pairs or plain objects
        const entry = Array.isArray(raw) && raw.length > 0
          ? (Array.isArray(raw[0]) ? raw[0][1] : raw[0])
          : null;
        if (entry && entry.remainingTime != null) {
          // remainingTime is ms remaining at the moment HA last updated the sensor
          const lastUpdated  = new Date(stateObj.last_updated).getTime();
          const elapsed      = Date.now() - lastUpdated;           // ms since last poll
          const remaining    = Math.max(0, entry.remainingTime - elapsed) / 1000;
          // total = full original duration; derived from createdDate + remainingTime at poll
          const total = entry.createdDate
            ? ((lastUpdated + entry.remainingTime) - entry.createdDate) / 1000
            : (this._attrDuration(attrs) || remaining);
          const paused = entry.status === 'PAUSED' || entry.status === 'paused';
          return { seconds: remaining, state: paused ? 'paused' : (remaining > 0 ? 'active' : 'idle'), total: Math.max(total, remaining) };
        }
      } catch (_) { /* fall through */ }
    }

    if (['idle', 'active', 'paused'].includes(state)) {
      const total = this._parseDuration(attrs.duration || '0:00:00');
      if (state === 'idle')   return { seconds: total, state: 'idle', total };
      if (state === 'paused') return { seconds: this._parseDuration(attrs.remaining || '0:00:00'), state: 'paused', total };
      if (attrs.finishes_at)  return { seconds: Math.max(0, (new Date(attrs.finishes_at) - Date.now()) / 1000), state: 'active', total };
      return { seconds: this._parseDuration(attrs.remaining || '0:00:00'), state: 'active', total };
    }

    const asDate = new Date(state);
    if (!isNaN(asDate.getTime()) && state.includes('T')) {
      const remaining = Math.max(0, (asDate - Date.now()) / 1000);
      const total = this._attrDuration(attrs) || remaining;
      return { seconds: remaining, state: remaining <= 0 ? 'idle' : 'active', total };
    }

    const fireAttr = attrs.fire_time || attrs.finishes_at || attrs.end_time;
    if (fireAttr) {
      const fireDate = new Date(fireAttr);
      if (!isNaN(fireDate.getTime())) {
        const remaining = Math.max(0, (fireDate - Date.now()) / 1000);
        const total = this._attrDuration(attrs) || remaining;
        return { seconds: remaining, state: remaining <= 0 ? 'idle' : 'active', total };
      }
    }

    if (attrs.remaining != null) {
      const rem   = typeof attrs.remaining === 'number' ? attrs.remaining : this._parseDuration(String(attrs.remaining));
      const total = this._attrDuration(attrs) || rem;
      const paused = attrs.status === 'paused' || attrs.paused === true;
      return { seconds: rem, state: paused ? 'paused' : (rem > 0 ? 'active' : 'idle'), total };
    }

    const asNum = parseFloat(state);
    if (!isNaN(asNum)) {
      const total = this._attrDuration(attrs) || asNum;
      return { seconds: Math.max(0, asNum), state: asNum > 0 ? 'active' : 'idle', total };
    }

    const asDur = this._parseDuration(state);
    if (asDur > 0) {
      const total = this._attrDuration(attrs) || asDur;
      return { seconds: asDur, state: 'active', total };
    }

    return { seconds: 0, state: 'idle', total: 0 };
  }

  _attrDuration(attrs) {
    for (const key of ['duration', 'total_duration', 'original_duration', 'total']) {
      if (attrs[key] != null) {
        const v = typeof attrs[key] === 'number' ? attrs[key] : this._parseDuration(String(attrs[key]));
        if (v > 0) return v;
      }
    }
    return 0;
  }

  _parseDuration(str) {
    if (!str) return 0;
    const asNum = parseFloat(str);
    if (!isNaN(asNum) && !str.includes(':')) return asNum;
    const parts = str.split(':').map(Number);
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    if (parts.length === 2) return parts[0] * 60  + parts[1];
    return 0;
  }

  // ── Colour helpers ───────────────────────────────────────────────────────────

  /** Linearly interpolate between two 6-digit hex colours. t=0 → c1, t=1 → c2 */
  _lerpColor(c1, c2, t) {
    const h = s => parseInt(s, 16);
    const r = Math.round(h(c1.slice(1,3)) + (h(c2.slice(1,3)) - h(c1.slice(1,3))) * t);
    const g = Math.round(h(c1.slice(3,5)) + (h(c2.slice(3,5)) - h(c1.slice(3,5))) * t);
    const b = Math.round(h(c1.slice(5,7)) + (h(c2.slice(5,7)) - h(c1.slice(5,7))) * t);
    return '#' + [r,g,b].map(v => Math.min(255, Math.max(0, v)).toString(16).padStart(2,'0')).join('');
  }

  /**
   * Returns the ring colour for the current progress fraction (0–1).
   *   pct > 0.5  → accent colour unchanged
   *   0.25–0.5   → accent fades to amber (#FF9F0A)
   *   0–0.25     → amber fades to red   (#FF3B30)
   */
  _ringColor(pct, accent) {
    const AMBER = '#FF9F0A';
    const RED   = '#FF3B30';
    const safeAccent = /^#[0-9a-fA-F]{6}$/.test(accent) ? accent : '#FF9F0A';
    if (pct >= 0.5) return safeAccent;
    if (pct >= 0.25) {
      const t = 1 - ((pct - 0.25) / 0.25);   // 0 at pct=0.5, 1 at pct=0.25
      return this._lerpColor(safeAccent, AMBER, t);
    }
    const t = 1 - (pct / 0.25);               // 0 at pct=0.25, 1 at pct=0
    return this._lerpColor(AMBER, RED, t);
  }

  _formatTime(totalSeconds) {
    const s     = Math.max(0, Math.ceil(totalSeconds));
    const hours = Math.floor(s / 3600);
    const mins  = Math.floor((s % 3600) / 60);
    const secs  = s % 60;
    const hh = String(hours).padStart(2, '0');
    const mm = String(mins).padStart(2, '0');
    const ss = String(secs).padStart(2, '0');
    return hours > 0 ? `${hh}:${mm}:${ss}` : `${mm}:${ss}`;
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
    const cfg    = this._config;
    const acc    = cfg.accent_color || '#FF9F0A';
    const txt    = cfg.text_color   || '#ffffff';
    const bg     = this._bgStyle();
    const isRing = cfg.display_style !== 'digits';
    const showName = cfg.show_name !== false;
    const R = 100;
    const C = (2 * Math.PI * R).toFixed(2);

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
          padding: ${isRing ? '14px' : (showName ? '18px 20px 20px' : '20px')};
          font-family: -apple-system, "SF Pro Display", BlinkMacSystemFont, "Helvetica Neue", sans-serif;
          color: ${txt};
          overflow: hidden;
          user-select: none;
          -webkit-user-select: none;
          box-sizing: border-box;
          display: flex;
          flex-direction: column;
          align-items: center;
          cursor: pointer;
          gap: ${showName ? '10px' : '0'};
        }

        .timer-name {
          text-align: center;
          font-size: 15px;
          font-weight: 500;
          color: ${txt};
          opacity: 0.55;
          letter-spacing: 0.01em;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          width: 100%;
          padding: 0 4px;
          box-sizing: border-box;
          flex-shrink: 0;
        }

        /* ── Ring ── */
        .ring-container {
          position: relative;
          /* fills available width; aspect-ratio makes it square */
          width: 100%;
          aspect-ratio: 1 / 1;
          min-width: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          /* container query so digits scale with card width */
          container-type: inline-size;
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
          transition: stroke-dashoffset 0.6s cubic-bezier(0.4, 0, 0.2, 1),
                      stroke 1s ease;
          filter: drop-shadow(0 0 6px ${acc}88);
        }

        /* ── Digits ── */
        .time-digits {
          font-variant-numeric: tabular-nums;
          color: ${txt};
          line-height: 1;
          white-space: nowrap;
          transition: opacity 0.4s ease;
          position: relative;
          z-index: 1;
        }

        /* Scale with ring-container width via container query */
        .ring-container .time-digits {
          font-size: clamp(18px, 26cqw, 58px);
          font-weight: 200;
          letter-spacing: -0.05em;
        }

        .digits-only {
          font-size: clamp(36px, 18vw, 72px);
          font-weight: 100;
          letter-spacing: -0.05em;
          width: 100%;
          text-align: ${cfg.digits_align || 'center'};
          padding: 0 4px;
          box-sizing: border-box;
        }

        .time-digits.is-paused {
          opacity: 0.45;
          animation: blink 1.6s ease-in-out infinite;
        }

        @keyframes blink {
          0%, 100% { opacity: 0.45; }
          50%       { opacity: 0.75; }
        }
      </style>

      <ha-card>
        <div class="card">
          ${showName ? `<div class="timer-name" id="timerName"></div>` : ''}
          ${isRing ? `
            <div class="ring-container">
              <svg class="ring-svg" viewBox="0 0 220 220">
                <circle class="ring-bg"       cx="110" cy="110" r="${R}"/>
                <circle class="ring-progress" cx="110" cy="110" r="${R}"
                  id="ringProgress"
                  stroke-dasharray="${C}"
                  stroke-dashoffset="0"/>
              </svg>
              <div class="time-digits" id="timeDigits">--:--</div>
            </div>
          ` : `
            <div class="time-digits digits-only" id="timeDigits">--:--</div>
          `}
        </div>
      </ha-card>
    `;
    // Tap to show info popup
    this.shadowRoot.querySelector('.card').addEventListener('click', () => this._showPopup());
  }

  // ── Update ───────────────────────────────────────────────────────────────────

  _update() {
    if (!this._hass || !this._rendered) return;
    const cfg    = this._config;
    const root   = this.shadowRoot;
    const nameEl = root.getElementById('timerName');
    const timeEl = root.getElementById('timeDigits');
    const ringEl = root.getElementById('ringProgress');
    if (!timeEl) return;

    const stateObj  = cfg?.entity ? this._hass.states[cfg.entity] : null;
    const haName    = stateObj?.attributes?.friendly_name || cfg.entity || '';
    const labelName = (cfg.custom_name || '').trim() || haName;
    if (nameEl) nameEl.textContent = labelName;

    if (!stateObj) {
      timeEl.textContent = '--:--';
      return;
    }

    const info = this._getRemaining();
    if (!info) return;

    timeEl.textContent = this._formatTime(info.seconds);
    timeEl.classList.toggle('is-paused', info.state === 'paused');

    if (ringEl) {
      const C   = 2 * Math.PI * 100;
      const pct = info.total > 0
        ? Math.min(1, Math.max(0, info.seconds / info.total))
        : (info.state === 'idle' ? 1 : 0);
      ringEl.style.strokeDashoffset = (C * (1 - pct)).toFixed(3);
      // Live colour: accent → amber → red as time runs out
      const ringColor = this._ringColor(pct, cfg.accent_color || '#FF9F0A');
      ringEl.style.stroke  = ringColor;
      ringEl.style.filter  = `drop-shadow(0 0 6px ${ringColor}88)`;
    }
  }

  // ── Popup ───────────────────────────────────────────────────────────────────

  _fmtClock(date) {
    if (!(date instanceof Date) || isNaN(date)) return '—';
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  _fmtDate(date) {
    if (!(date instanceof Date) || isNaN(date)) return '—';
    const today    = new Date();
    const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
    if (date.toDateString() === today.toDateString())    return 'Today';
    if (date.toDateString() === tomorrow.toDateString()) return 'Tomorrow';
    return date.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
  }

  _fmtDuration(seconds) {
    const s = Math.round(seconds);
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    if (h > 0) return `${h}h ${m}m`;
    if (m > 0 && sec === 0) return `${m} minute${m !== 1 ? 's' : ''}`;
    if (m > 0) return `${m}m ${sec}s`;
    return `${sec} second${sec !== 1 ? 's' : ''}`;
  }

  _buildPopupRows() {
    const cfg      = this._config;
    const stateObj = this._hass?.states[cfg?.entity];
    if (!stateObj) return [];

    const attrs  = stateObj.attributes;
    const info   = this._getRemaining();
    if (!info) return [];

    const acc    = cfg.accent_color || '#FF9F0A';
    const rows   = [];

    // ── Status ──────────────────────────────────────────────────────────────
    const statusLabel = { active: 'Running', paused: 'Paused', idle: 'Idle' }[info.state] || info.state;
    const statusColor = info.state === 'active' ? acc : info.state === 'paused' ? '#FF9F0A' : 'rgba(255,255,255,0.35)';
    rows.push({ label: 'Status', value: statusLabel, color: statusColor });

    // ── Derive start time and fire time ──────────────────────────────────────
    let startedAt = null;
    let finishesAt = null;

    // Alexa sorted_active path
    if (attrs.sorted_active != null) {
      try {
        const raw   = typeof attrs.sorted_active === 'string' ? JSON.parse(attrs.sorted_active) : attrs.sorted_active;
        const entry = Array.isArray(raw) && raw.length > 0 ? (Array.isArray(raw[0]) ? raw[0][1] : raw[0]) : null;
        if (entry) {
          const lastUpdated = new Date(stateObj.last_updated).getTime();
          const elapsed     = Date.now() - lastUpdated;
          const remMs       = Math.max(0, entry.remainingTime - elapsed);
          finishesAt = new Date(Date.now() + remMs);
          if (entry.createdDate) startedAt = new Date(entry.createdDate);

          // Timer label from Alexa (if user named it)
          if (entry.timerLabel) rows.push({ label: 'Label', value: entry.timerLabel });

          // Multiple active timers note
          if (Array.isArray(raw) && raw.length > 1) {
            rows.push({ label: 'Active Timers', value: String(raw.length), color: acc });
          }
        }
      } catch (_) {}
    }

    // Native timer path
    if (!finishesAt && attrs.finishes_at) {
      finishesAt = new Date(attrs.finishes_at);
    }
    if (!startedAt && finishesAt && info.total > 0) {
      startedAt = new Date(finishesAt.getTime() - info.total * 1000);
    }
    // Paused: derive finishes_at from remaining
    if (!finishesAt && info.seconds > 0) {
      finishesAt = new Date(Date.now() + info.seconds * 1000);
    }

    // ── Time rows ────────────────────────────────────────────────────────────
    if (startedAt) {
      rows.push({ label: 'Started', value: `${this._fmtClock(startedAt)}` + (this._fmtDate(startedAt) !== 'Today' ? `  ·  ${this._fmtDate(startedAt)}` : '') });
    }

    if (finishesAt && info.state !== 'idle') {
      rows.push({ label: 'Finishes', value: `${this._fmtClock(finishesAt)}` + (this._fmtDate(finishesAt) !== 'Today' ? `  ·  ${this._fmtDate(finishesAt)}` : ''), color: acc });
    }

    // ── Duration & remaining ─────────────────────────────────────────────────
    if (info.total > 0) {
      rows.push({ label: 'Duration', value: this._fmtDuration(info.total) });
    }

    if (info.state !== 'idle') {
      rows.push({ label: 'Remaining', value: this._fmtDuration(info.seconds) });
      const pct = info.total > 0 ? Math.round((info.seconds / info.total) * 100) : 0;
      rows.push({ label: 'Progress', value: `${pct}% remaining`, color: this._ringColor(pct / 100, acc) });
    }

    return rows;
  }

  _showPopup() {
    if (this._popupEl) this._closePopup();
    const cfg      = this._config;
    const stateObj = this._hass?.states[cfg?.entity];
    if (!stateObj) return;

    const acc    = cfg.accent_color  || '#FF9F0A';
    const txt    = cfg.text_color    || '#ffffff';
    const rawBg  = cfg.card_bg || '#1c1c1e';
    const bgBase = rawBg === '#000000' ? '#1c1c1e' : rawBg.substring(0, 7);
    const labelName = (cfg.custom_name || '').trim()
      || stateObj.attributes?.friendly_name
      || cfg.entity || 'Timer';

    const overlay = document.createElement('div');
    overlay.style.cssText = [
      'position:fixed', 'inset:0', 'z-index:9999',
      'display:flex', 'align-items:center', 'justify-content:center',
      'background:rgba(0,0,0,0.55)',
      'backdrop-filter:blur(10px)',
      '-webkit-backdrop-filter:blur(10px)',
      'animation:ccFadeIn 0.18s ease',
    ].join(';');

    const sheet = document.createElement('style');
    sheet.textContent = `
      @keyframes ccFadeIn  { from { opacity:0; transform:scale(0.94) } to { opacity:1; transform:scale(1) } }
      @keyframes ccFadeOut { from { opacity:1; transform:scale(1) } to { opacity:0; transform:scale(0.94) } }
    `;
    overlay.appendChild(sheet);

    const popup = document.createElement('div');
    popup.style.cssText = [
      `background:${bgBase}ee`,
      'backdrop-filter:blur(28px) saturate(180%)',
      '-webkit-backdrop-filter:blur(28px) saturate(180%)',
      `border:1px solid rgba(255,255,255,0.14)`,
      'border-radius:24px',
      'padding:24px 24px 20px',
      'min-width:280px',
      'max-width:360px',
      'width:calc(100vw - 48px)',
      `font-family:-apple-system,"SF Pro Display",BlinkMacSystemFont,"Helvetica Neue",sans-serif`,
      `color:${txt}`,
      'box-shadow:0 24px 64px rgba(0,0,0,0.5)',
      'box-sizing:border-box',
    ].join(';');

    // Header
    const header = document.createElement('div');
    header.style.cssText = 'display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;';
    header.innerHTML = `
      <div style="font-size:17px;font-weight:600;letter-spacing:-0.01em;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;padding-right:12px;">${labelName}</div>
      <button id="ccClose" style="background:rgba(255,255,255,0.1);border:none;border-radius:50%;width:28px;height:28px;cursor:pointer;color:${txt};display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:14px;line-height:1;">✕</button>
    `;
    popup.appendChild(header);

    // Rows container
    const rowsEl = document.createElement('div');
    rowsEl.id = 'ccRows';
    rowsEl.style.cssText = 'display:flex;flex-direction:column;gap:0;';
    popup.appendChild(rowsEl);

    overlay.appendChild(popup);
    document.body.appendChild(overlay);
    this._popupEl = overlay;

    const renderRows = () => {
      const rows = this._buildPopupRows();
      rowsEl.innerHTML = rows.map((r, i) => `
        <div style="display:flex;justify-content:space-between;align-items:baseline;padding:11px 0;${i < rows.length - 1 ? 'border-bottom:1px solid rgba(255,255,255,0.07)' : ''}">
          <span style="font-size:13px;opacity:0.45;font-weight:500;letter-spacing:0.01em;">${r.label}</span>
          <span style="font-size:14px;font-weight:500;text-align:right;${r.color ? `color:${r.color}` : ''}">${r.value}</span>
        </div>
      `).join('');
    };

    renderRows();
    this._popupInterval = setInterval(renderRows, 1000);

    overlay.querySelector('#ccClose').addEventListener('click', (e) => { e.stopPropagation(); this._closePopup(); });
    overlay.addEventListener('click', (e) => { if (e.target === overlay) this._closePopup(); });
    document.addEventListener('keydown', this._popupKeyHandler = (e) => { if (e.key === 'Escape') this._closePopup(); });
  }

  _closePopup() {
    if (this._popupInterval) { clearInterval(this._popupInterval); this._popupInterval = null; }
    if (this._popupKeyHandler) { document.removeEventListener('keydown', this._popupKeyHandler); this._popupKeyHandler = null; }
    if (this._popupEl) { this._popupEl.remove(); this._popupEl = null; }
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

    const cfg         = this._config;
    const selEnt      = cfg.entity || '';
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
          max-height: 220px; overflow-y: auto;
          -webkit-overflow-scrolling: touch;
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 8px; background: var(--card-background-color);
        }
        .entity-list.hidden { display: none; }
        .entity-option {
          padding: 10px 12px; font-size: 13px; cursor: pointer;
          border-bottom: 1px solid rgba(255,255,255,0.05);
          display: flex; flex-direction: column; gap: 2px;
        }
        .entity-option:last-child { border-bottom: none; }
        .entity-option:hover, .entity-option.selected { background: rgba(255,255,255,0.07); }
        .entity-option.selected { color: #FF9F0A; }
        .entity-option-id { font-size: 11px; opacity: 0.5; font-family: monospace; }

        /* ── Toggles ── */
        .toggle-list { display: flex; flex-direction: column; }
        .toggle-item {
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

        /* ── Custom name input row ── */
        .input-row { padding: 12px 16px; display: flex; flex-direction: column; gap: 6px; }
        .input-row label { font-size: 14px; font-weight: 500; }

        /* ── Segmented control ── */
        .segmented-row { padding: 12px 16px; display: flex; flex-direction: column; gap: 8px; }
        .segmented-row label { font-size: 14px; font-weight: 500; }
        .segmented { display: flex; background: rgba(118,118,128,0.2); border-radius: 9px; padding: 2px; gap: 2px; }
        .segmented input[type="radio"] { display: none; }
        .segmented label {
          flex: 1; text-align: center; padding: 8px 4px; font-size: 13px; font-weight: 500;
          border-radius: 7px; cursor: pointer; color: var(--primary-text-color);
          transition: all 0.2s ease; white-space: nowrap;
        }
        .segmented input[type="radio"]:checked + label {
          background: #FF9F0A; color: #fff;
          box-shadow: 0 1px 4px rgba(0,0,0,0.3);
        }

        /* ── Colour pickers ── */
        .colour-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
        .colour-card {
          border: 1px solid var(--divider-color, rgba(0,0,0,0.12));
          border-radius: 10px; overflow: hidden; cursor: pointer;
          transition: box-shadow 0.15s, border-color 0.15s;
        }
        .colour-card:hover { box-shadow: 0 2px 10px rgba(0,0,0,0.12); border-color: var(--primary-color, #007AFF); }
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

        <!-- Entity -->
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

        <!-- Display -->
        <div>
          <div class="section-title">Display</div>
          <div class="card-block">

            <div class="segmented-row" style="border-bottom:1px solid rgba(255,255,255,0.06);">
              <label>Style</label>
              <div class="segmented">
                <input type="radio" name="display_style" id="ds_ring"   value="ring">
                <label for="ds_ring">Ring &amp; Time</label>
                <input type="radio" name="display_style" id="ds_digits" value="digits">
                <label for="ds_digits">Time Only</label>
              </div>
            </div>

            <div class="segmented-row" id="alignRow" style="border-bottom:1px solid rgba(255,255,255,0.06);${(cfg.display_style || 'ring') !== 'digits' ? 'display:none' : ''}">
              <label>Alignment</label>
              <div class="segmented">
                <input type="radio" name="digits_align" id="da_left"   value="left">
                <label for="da_left">Left</label>
                <input type="radio" name="digits_align" id="da_center" value="center">
                <label for="da_center">Centre</label>
                <input type="radio" name="digits_align" id="da_right"  value="right">
                <label for="da_right">Right</label>
              </div>
            </div>

            <div class="toggle-list">
              <div class="toggle-item">
                <div>
                  <div class="toggle-label">Show Timer Name</div>
                  <div class="toggle-desc">Display the name label above the countdown</div>
                </div>
                <label class="toggle-switch">
                  <input type="checkbox" id="show_name" ${cfg.show_name !== false ? 'checked' : ''}>
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

            <div class="input-row" id="customNameRow" style="border-top:1px solid rgba(255,255,255,0.06);${cfg.show_name === false ? 'display:none' : ''}">
              <label for="custom_name">Custom Name</label>
              <div class="hint">Leave blank to use the entity's friendly name</div>
              <input type="text" id="custom_name"
                placeholder="e.g. Kitchen Timer"
                value="${cfg.custom_name || ''}"
                autocomplete="off" spellcheck="false">
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

    const dsEl = this.shadowRoot.getElementById('ds_' + (cfg.display_style || 'ring'));
    if (dsEl) dsEl.checked = true;
    const daEl = this.shadowRoot.getElementById('da_' + (cfg.digits_align || 'center'));
    if (daEl) daEl.checked = true;

    this._buildColourPickers();
    this._setupListeners();
  }

  _setupListeners() {
    const root        = this.shadowRoot;
    const searchInput = root.getElementById('entitySearch');
    const listEl      = root.getElementById('entityList');

    searchInput.addEventListener('focus', () => { this._filterList(''); listEl.classList.remove('hidden'); });
    searchInput.addEventListener('input', () => { this._filterList(searchInput.value); listEl.classList.remove('hidden'); });
    listEl.addEventListener('mousedown', (e) => {
      const opt = e.target.closest('.entity-option');
      if (!opt) return;
      e.preventDefault();
      const id = opt.dataset.id;
      searchInput.value = id;
      listEl.classList.add('hidden');
      listEl.querySelectorAll('.entity-option').forEach(o => o.classList.toggle('selected', o.dataset.id === id));
      this._updateConfig('entity', id);
    });
    searchInput.addEventListener('blur', () => { setTimeout(() => listEl.classList.add('hidden'), 150); });

    ['ring', 'digits'].forEach(v => {
      const el = root.getElementById('ds_' + v);
      if (el) el.onchange = () => {
        this._updateConfig('display_style', v);
        const alignRow = root.getElementById('alignRow');
        if (alignRow) alignRow.style.display = v === 'digits' ? '' : 'none';
      };
    });

    ['left', 'center', 'right'].forEach(v => {
      const el = root.getElementById('da_' + v);
      if (el) el.onchange = () => this._updateConfig('digits_align', v);
    });

    root.getElementById('show_name').onchange = (e) => {
      this._updateConfig('show_name', e.target.checked);
      const row = root.getElementById('customNameRow');
      if (row) row.style.display = e.target.checked ? '' : 'none';
    };

    root.getElementById('use_glassmorphism').onchange = (e) => this._updateConfig('use_glassmorphism', e.target.checked);

    const customNameInput = root.getElementById('custom_name');
    let nameDebounce;
    customNameInput.addEventListener('input', () => {
      clearTimeout(nameDebounce);
      nameDebounce = setTimeout(() => this._updateConfig('custom_name', customNameInput.value), 300);
    });
  }

  _filterList(term) {
    const lower = term.toLowerCase();
    this.shadowRoot.querySelectorAll('.entity-option').forEach(opt => {
      opt.style.display = opt.textContent.toLowerCase().includes(lower) ? '' : 'none';
    });
  }

  _buildColourPickers() {
    const COLOUR_FIELDS = [
      { key: 'accent_color', label: 'Accent / Ring',   desc: 'Progress ring and active state colour',           default: '#FF9F0A', maxlen: 7 },
      { key: 'text_color',   label: 'Text Colour',     desc: 'Time digits and name label colour',               default: '#ffffff', maxlen: 7 },
      { key: 'card_bg',      label: 'Card Background', desc: '#000000 = transparent · 8-digit hex for opacity', default: '#1c1c1e', maxlen: 9 },
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

    const dsEl = root.getElementById('ds_' + (this._config.display_style || 'ring'));
    if (dsEl) dsEl.checked = true;
    const daEl = root.getElementById('da_' + (this._config.digits_align || 'center'));
    if (daEl) daEl.checked = true;
    const alignRow = root.getElementById('alignRow');
    if (alignRow) alignRow.style.display = (this._config.display_style || 'ring') === 'digits' ? '' : 'none';

    const showName = root.getElementById('show_name');
    if (showName) showName.checked = this._config.show_name !== false;

    const customNameRow = root.getElementById('customNameRow');
    if (customNameRow) customNameRow.style.display = this._config.show_name === false ? 'none' : '';

    const customNameInput = root.getElementById('custom_name');
    if (customNameInput) customNameInput.value = this._config.custom_name || '';

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
