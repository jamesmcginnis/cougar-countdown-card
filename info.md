# Cougar Countdown Card

A countdown timer card for Home Assistant with a smooth animated progress ring, live digit display, and a sleek frosted-glass interface.

## Key Features

- **Animated Progress Ring** — circular ring drains smoothly as time elapses, with a soft glow matching your accent colour
- **Live Countdown** — frame-accurate updates every 500 ms from the timer's `finishes_at` attribute
- **Show / Hide Seconds** — toggle seconds on or off; the ring and digits adapt automatically
- **State Pill** — small badge showing Running, Paused or Idle beneath the digits
- **Glassmorphic Background** — frosted-glass blur effect; toggle off for solid, or use `#000000` for full transparency
- **Full Visual Editor** — no YAML required; pick your entity from a dropdown, toggle options, and choose colours via native pickers with hex input

## Quick Start

```yaml
type: custom:cougar-countdown-card
entity: timer.kitchen
show_seconds: true
accent_color: '#FF9F0A'
use_glassmorphism: true
```

All settings — entity selection, seconds toggle, glassmorphism, and all colour pickers — are available through the built-in visual editor. No YAML editing required.
