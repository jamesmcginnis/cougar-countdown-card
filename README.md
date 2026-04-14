# Cougar Countdown Card

A sleek countdown timer card for Home Assistant. Displays your timer entities with a smooth animated progress ring, large digit display, and a frosted-glass interface.

[![hacs_badge](https://img.shields.io/badge/HACS-Custom-41BDF5.svg)](https://my.home-assistant.io/redirect/hacs_repository/?owner=jamesmcginnis&repository=cougar-countdown-card&category=plugin)

## Features

- **Animated Progress Ring** — a circular ring drains smoothly as time elapses, with a soft glow that matches your chosen accent colour
- **Large Digit Display** — thin-weight tabular digits centred inside the ring; paused timers gently blink to indicate their state
- **Live Countdown** — frame-accurate updates every 500 ms using the timer's `finishes_at` attribute, with no extra polling
- **Show / Hide Seconds** — toggle seconds on or off from the visual editor; the ring and digits adapt automatically
- **State Pill** — a small badge beneath the digits shows the current state: Running, Paused or Idle
- **Glassmorphic Background** — frosted-glass blur effect; toggle off for a solid background, or use `#000000` for full transparency
- **Full Visual Editor** — no YAML required; pick your timer entity from a dropdown, toggle options, and set colours with native pickers and hex input

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
entity: timer.kitchen
show_seconds: true
use_glassmorphism: true
accent_color: '#FF9F0A'
text_color: '#ffffff'
card_bg: '#1c1c1ecc'
```

### Configuration Options

| Key | Type | Default | Description |
|---|---|---|---|
| `entity` | string | — | **Required.** The `timer.*` entity to display |
| `show_seconds` | boolean | `true` | Show seconds in the countdown digits |
| `use_glassmorphism` | boolean | `true` | Apply frosted-glass blur to the card background |
| `accent_color` | hex string | `#FF9F0A` | Progress ring and active state colour |
| `text_color` | hex string | `#ffffff` | Time digits and name label colour |
| `card_bg` | hex string | `#1c1c1e` | Card background colour |

### Background Colour Notes

- **`#000000`** — fully transparent; the dashboard background shows through
- **6-digit hex** (e.g. `#1c1c1e`) — solid colour when glassmorphism is off; when on, `cc` opacity (~80%) is added automatically
- **8-digit hex** (e.g. `#1c1c1e80`) — precise opacity control regardless of the glassmorphism toggle

## Quick Start YAML

```yaml
type: custom:cougar-countdown-card
entity: timer.laundry
accent_color: '#FF9F0A'
```
