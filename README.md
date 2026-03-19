# Learn Vents

An interactive educational tool for teaching mechanical ventilation physiology to medical residents and ICU fellows. Built to bridge the gap between clinical ventilator settings and underlying lung physiology.

Based on concepts from Carteaux, Spinelli & Jaber — *Intensive Care Medicine* (2026).

## Modules

The app progresses from fundamentals to advanced synthesis across 11 interactive modules:

| Module | Description |
|--------|-------------|
| **Basics** | Ventilator fundamentals — modes (AC/VC, AC/PC, SIMV, PSV), breath cycle phases, initial settings by indication, and the MRI DEATH troubleshooting checklist |
| **Waveforms** | Animated pressure, flow, and volume waveforms with adjustable parameters |
| **Pcond** | Conductive pressure and airway opening phenomena |
| **Stress Index** | Visual curve fitting (Paw = a × t^b + c) to identify recruitment vs. overdistension |
| **ΔP & MP** | Driving pressure and mechanical power calculator with IBW-based alerts |
| **R/I Ratio** | Recruitment-to-inflation ratio for assessing lung recruitability |
| **Time Constant (τ)** | Interactive τ = C_RS × R_RS visualization with expiratory flow modeling |
| **P-V Loops** | Four clinical scenarios (Normal, Early ARDS, Fibroproliferative, COPD) with real-time loop rendering |
| **Recruitment/Derecruitment** | Animated alveolar recruitment with acinar state tracking at adjustable PEEP |
| **PEEP Goal** | Clinical synthesis — titration strategy integrating all prior concepts |
| **Quiz** | Categorized multiple-choice questions covering all modules |

Additional features include an interactive glossary with 60+ medical term tooltips and a Board Essentials section for exam prep.

## Tech Stack

- **React 18** — UI framework
- **Vite** — Build tool and dev server
- **Canvas API** — High-performance waveform and P-V loop rendering
- **Netlify** — Hosting and deployment

## Getting Started

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## Project Structure

```
├── index.html                  # Entry point (loads Google Fonts)
├── vent-physiology-tool.jsx    # Main application component
├── src/
│   ├── main.jsx                # React mount point
│   └── App.jsx                 # App wrapper
├── vite.config.js              # Vite configuration
└── netlify.toml                # Deployment config (SPA redirects)
```

## License

All rights reserved.
