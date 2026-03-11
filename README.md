# Workplace Intelligence Platform

**AI-powered office interior design** — upload an empty DWG/DXF floor plan and get a fully
optimised workplace layout in minutes, powered by Claude Opus 4.6.

---

## What It Does

| Step | What Happens |
|------|-------------|
| 1. Upload `.DWG` or `.DXF` | `ezdxf` parses the file, detecting walls, rooms, core elements (stairs/lifts/bathrooms), and columns |
| 2. Configure requirements | Set headcount, work style, density, meeting room mix, special spaces, and department zones |
| 3. AI generates layout | Claude Opus 4.6 with adaptive thinking creates an optimised layout with full rationale |
| 4. Review & customise | Interactive SVG viewer with layers, space click-through, statistics, and export |

---

## Architecture

```
workplace-intelligence-platform/
├── backend/                     # Python FastAPI
│   ├── main.py                  # API routes
│   ├── models/
│   │   ├── floor_plan.py        # Pydantic models for parsed DWG data
│   │   └── layout.py            # Layout, space, furniture models
│   └── services/
│       ├── dwg_parser.py        # DWG/DXF → FloorPlanData (ezdxf + shapely)
│       ├── space_analyzer.py    # Space programme + fit assessment
│       └── ai_layout_generator.py  # Claude Opus 4.6 layout generation
│
└── frontend/                    # React + TypeScript + Vite
    └── src/
        ├── App.tsx              # Step-by-step flow (upload → requirements → generate → review)
        ├── components/
        │   ├── FileUpload/      # Drag-and-drop DWG/DXF upload
        │   ├── LayoutCustomizer/ # Client requirements form
        │   ├── FloorPlanViewer/ # SVG-based interactive floor plan
        │   ├── AIResults/       # Statistics, AI rationale, recommendations
        │   └── Sidebar/         # Results panel
        ├── services/api.ts      # Axios API client
        ├── store/layoutStore.ts # Zustand state management
        └── types/index.ts       # TypeScript types
```

---

## Quick Start

### Prerequisites

- Python 3.11+
- Node 18+
- Anthropic API key

### 1. Clone and configure

```bash
git clone <repo>
cd workplace-intelligence-platform
cp .env.example .env
# Edit .env and set ANTHROPIC_API_KEY=sk-ant-...
```

### 2. Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

### 3. Frontend

```bash
cd frontend
npm install
npm run dev   # Starts on http://localhost:3000
```

### 4. Docker Compose (alternative)

```bash
cp .env.example .env
# Set ANTHROPIC_API_KEY in .env
docker compose up --build
```

Visit `http://localhost:3000`

---

## Supported File Formats

| Format | Versions | Notes |
|--------|----------|-------|
| DXF | R12 → R2018 | Full support via `ezdxf` |
| DWG | R2004 → R2024 | Direct support via `ezdxf`; older files: export to DXF from AutoCAD |

### Tips for best results

- Export from AutoCAD as **DXF R2010** if DWG parsing fails
- Ensure walls are on a layer named `WALL`, `A-WALL`, or similar
- Close all room polylines for accurate room detection
- Keep the drawing in **millimetres** (most common) or **metres**

---

## API Reference

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/upload` | POST | Upload DWG/DXF file |
| `/api/analyze/{plan_id}` | POST | Analyse floor plan with requirements |
| `/api/generate-layout/{plan_id}` | POST | Generate AI layout (full response) |
| `/api/generate-layout-stream/{plan_id}` | POST | Stream AI generation (SSE) |
| `/api/demo-layout` | POST | Generate using built-in 2000m² demo plan |
| `/api/layout/{layout_id}` | GET | Retrieve generated layout |
| `/api/layout/{layout_id}` | PUT | Update layout (customisation) |
| `/api/space-types` | GET | Available space types with colours |

---

## AI Design Intelligence

The AI layer (Claude Opus 4.6) applies these workplace design principles automatically:

- **Natural light priority** — workstations placed within 6m of facade
- **Core placement** — enclosed rooms in internal zone to preserve perimeter light
- **BCO guidance** — meeting room ratios, circulation widths, DDA compliance
- **WELL Building Standard** — wellness rooms, biophilic elements, activity spaces
- **Activity-Based Working** — variety of settings for focused, collaborative, and social work
- **Acoustic zoning** — quiet focus zones separated from collaboration areas

---

## Customisation Options

- Headcount and desk sharing ratio
- Work style: Hybrid / ABW / Traditional / Hot-desking
- Density: Dense (7m²) → Executive (18m² per person)
- Space mix: % for meeting rooms, collaboration, focus, amenities
- Special spaces: reception, boardroom, wellness room, server room
- Industry and design style influences AI recommendations
- Department zones with headcounts
- Free-text special requirements for Claude to interpret

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| AI | Claude Opus 4.6 (Anthropic) — adaptive thinking |
| DWG/DXF parsing | `ezdxf` 1.3 |
| Geometry engine | `shapely` 2.0 |
| Backend | FastAPI + Python 3.11 |
| Frontend | React 18 + TypeScript + Vite |
| State management | Zustand |
| Animation | Framer Motion |
| Styling | Tailwind CSS |
| Floor plan rendering | SVG (custom renderer) |
