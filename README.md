# Cougar Countdown Card

> **Best experienced in Home Assistant dark mode** — the glassmorphic background, glowing progress ring and colour transitions are designed for dark dashboards.

A countdown timer card for Home Assistant with a smooth animated progress ring, live digit display, and a frosted-glass interface. Works with native HA timer entities and sensor-based timers from integrations such as Alexa Media Player and Google Home.

[![hacs_badge](https://img.shields.io/badge/HACS-Custom-41BDF5.svg)](https://my.home-assistant.io/redirect/hacs_repository/?owner=jamesmcginnis&repository=cougar-countdown-card&category=plugin)

## Features

- **Animated Progress Ring** — a circular ring drains smoothly as time elapses, with a soft glow that tracks the colour transition
- **Live Colour Transition** — the ring colour shifts from your accent colour through amber to red as the timer runs down, giving an at-a-glance sense of urgency
- **Two Display Styles** — choose between Ring & Time (circular progress ring with digits inside) or Time Only (large digits with left, centre or right alignment)
- **Accurate Alexa Timer Support** — reads `sorted_active` attributes from the Alexa Media Player integration to derive the true original duration and live remaining time, even accounting for polling lag
- **Tap for Details** — tap the card to open a glassmorphic popup showing when the timer was started, when it finishes, total duration, time remaining, progress percentage, and Alexa timer label if set. Updates live while open
- **Show / Hide Timer Name** — optionally display the entity's friendly name above the countdown, with an override field for a custom label
- **Glassmorphic Background** — frosted-glass blur effect designed for dark dashboards; toggle off for solid, or use `#000000` for full transparency
- **Full Visual Editor** — no YAML required; search any entity, toggle options, and set colours with native pickers and hex input
- **Responsive & Square** — the ring mode card maintains square proportions at any column width, with the font scaling proportionally via CSS container queries

## Dark Mode

This card is designed to be used with Home Assistant in **dark mode**. The frosted-glass background, glowing ring, and colour transitions all rely on a dark backdrop to look their best. In light mode the card will still function correctly but the glassmorphic effect will be far less effective.

To set dark mode in Home Assistant go to **Profile → Theme** and select a dark theme, or enable the automatic day/night theme switching.

## Installation via HACS

[![Open your Home Assistant instance and open a repository inside the Home Assistant Community Store.](https://my.home-assistant.io/badges/hacs_repository.svg)](https://my.home-assistant.io/redirect/hacs_repository/?owner=jamesmcginnis&repository=cougar-countdown-card&category=plugin)

1. Click the button above, or open HACS in your Home Assistant instance and go to **Frontend**
2. Click the three-dot menu → **Custom repositories**
3. Add `https://github.com/jamesmcginnis/cougar-countdown-card` as a **Plugin** repository
4. Find **Cougar Countdown Card** in the HACS Frontend list and click **Download**
5. Reload your browser

## Manual Installation

1. Download `cougar-countdown-card.js` from the [latest release](https://github.com/jamesmcginnis/cougar-countdown-card/releases)
2. Copy it to your `config/www/` directory
3. Add a resource entry in **Settings → Dashboards → Resources**:

```yaml
url: /local/cougar-countdown-card.js
type: module
```

4. Reload your browser

## Configuration

All settings are available through the built-in visual editor — no YAML editing required. For manual YAML configuration:

```yaml
type: custom:cougar-countdown-card
entity: sensor.kitchen_next_timer
show_name: true
custom_name: Kitchen Timer
display_style: ring
use_glassmorphism: true
accent_color: '#FF9F0A'
text_color: '#ffffff'
card_bg: '#1c1c1e'
```

### Configuration Options

| Key | Type | Default | Description |
|---|---|---|---|
| `entity` | string | — | **Required.** Any timer entity — `timer.*`, `sensor.*`, `input_datetime.*` etc. |
| `show_name` | boolean | `true` | Show the timer name label above the countdown |
| `custom_name` | string | `''` | Override the entity's friendly name with a custom label |
| `display_style` | `ring` \| `digits` | `ring` | `ring` shows the animated progress ring; `digits` shows large numbers only |
| `digits_align` | `left` \| `center` \| `right` | `center` | Alignment of the digits in Time Only mode |
| `use_glassmorphism` | boolean | `true` | Apply frosted-glass blur to the card background |
| `accent_color` | hex string | `#FF9F0A` | Starting colour for the progress ring — transitions to amber then red as time runs out |
| `text_color` | hex string | `#ffffff` | Time digits and name label colour |
| `card_bg` | hex string | `#1c1c1e` | Card background colour |

### Background Colour Notes

- **`#000000`** — fully transparent; the dashboard background shows through
- **6-digit hex** (e.g. `#1c1c1e`) — solid colour when glassmorphism is off; when on, `cc` opacity (~80%) is added automatically
- **8-digit hex** (e.g. `#1c1c1e80`) — precise opacity control regardless of the glassmorphism toggle

## Supported Entity Types

The card attempts to parse the remaining time from any entity. It handles the following shapes automatically, in priority order:

**Alexa Media Player** (`sensor.*_next_timer`) — reads `sorted_active` to derive the true remaining time corrected for polling lag, and calculates the original total duration from `createdDate`. Alexa timer labels are shown in the tap popup if set.

**Native HA timers** (`timer.*`) — uses `finishes_at`, `remaining` and `duration` attributes directly.

**ISO datetime state** — if the entity state is a datetime string representing when the timer fires, remaining time is calculated from that.

**Numeric state** — if the state is a number, it is treated as remaining seconds.

**Duration string state** — strings like `"5:00"` or `"0:05:00"` are parsed as remaining time.

## Ring Colour Transition

The progress ring colour shifts automatically as the timer counts down:

- **Above 50%** — your chosen accent colour
- **50% → 25%** — smoothly transitions from accent to amber
- **25% → 0%** — transitions from amber to red

## Tap Popup

Tapping the card opens a popup showing detailed timer information. The popup matches the card's glassmorphic aesthetic and updates live. It shows the following where available:

- **Status** — Running, Paused or Idle
- **Label** — Alexa timer name if set by voice
- **Active Timers** — count of simultaneous Alexa timers
- **Started** — the time the timer was set
- **Finishes** — the calculated fire time
- **Duration** — original total duration in plain English
- **Remaining** — current remaining time in plain English
- **Progress** — percentage remaining, coloured by the same ring transition

Dismiss the popup by tapping outside it, pressing the ✕ button, or pressing Escape.

## Quick Start YAML

```yaml
type: custom:cougar-countdown-card
entity: sensor.kitchen_next_timer
accent_color: '#FF9F0A'
use_glassmorphism: true
```
