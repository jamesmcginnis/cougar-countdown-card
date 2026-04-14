# Cougar Countdown Card

> **Best experienced in Home Assistant dark mode** — the glassmorphic background, glowing progress ring and colour transitions are designed for dark dashboards.

A countdown timer card for Home Assistant with a smooth animated progress ring, live digit display, and a frosted-glass interface. Works with native HA timers and sensor-based timers from Alexa Media Player and Google Home.

## Key Features

- **Animated Progress Ring** — circular ring drains smoothly as time elapses with a soft colour-matched glow
- **Live Colour Transition** — ring shifts from your accent colour through amber to red as time runs out
- **Two Display Styles** — Ring & Time, or Time Only with left / centre / right alignment
- **Accurate Alexa Support** — reads `sorted_active` to derive true remaining time and original duration, corrected for polling lag
- **Tap for Details** — glassmorphic popup shows started time, finish time, duration, remaining time, progress and Alexa timer label. Updates live while open
- **Show / Hide Name** — optional name label with custom override field
- **Glassmorphic Background** — frosted-glass blur built for dark dashboards; supports transparent and partial-opacity backgrounds
- **Responsive & Square** — ring mode stays square at any column width with container query font scaling
- **Full Visual Editor** — search any entity, toggle options, and set colours with native pickers

## Dark Mode

This card is designed for **dark mode**. The frosted-glass effect, glowing ring and colour transitions all rely on a dark backdrop. Enable a dark theme in **Profile → Theme**.

## Quick Start

```yaml
type: custom:cougar-countdown-card
entity: sensor.kitchen_next_timer
accent_color: '#FF9F0A'
use_glassmorphism: true
```

All settings — entity search, display style, alignment, name toggle, custom name, glassmorphism, and all colour pickers — are available in the built-in visual editor. No YAML editing required.
