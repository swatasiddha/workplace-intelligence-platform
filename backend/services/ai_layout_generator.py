"""
AI Layout Generator
Uses Claude Opus 4.6 with adaptive thinking to generate intelligent,
customised office workplace interior layouts from analysed floor plan data.
"""

import json
import uuid
import logging
from typing import AsyncIterator

import anthropic

from models.floor_plan import FloorPlanData
from models.layout import (
    ClientRequirements, GeneratedLayout, SpaceAllocation, LayoutZone,
    FurnitureItem, LayoutStatistics, SpaceType
)
from services.space_analyzer import analyze_floor_plan

logger = logging.getLogger(__name__)

# Colour palette for space types
SPACE_COLOURS = {
    SpaceType.WORKSTATION:           "#DBEAFE",  # blue-100
    SpaceType.PRIVATE_OFFICE:        "#EDE9FE",  # violet-100
    SpaceType.MEETING_ROOM_SMALL:    "#FCE7F3",  # pink-100
    SpaceType.MEETING_ROOM_MEDIUM:   "#F3E8FF",  # purple-100
    SpaceType.MEETING_ROOM_LARGE:    "#E0E7FF",  # indigo-100
    SpaceType.BOARDROOM:             "#C7D2FE",  # indigo-200
    SpaceType.COLLABORATION:         "#D1FAE5",  # emerald-100
    SpaceType.FOCUS_POD:             "#FEF3C7",  # amber-100
    SpaceType.BREAKOUT:              "#FEF9C3",  # yellow-100
    SpaceType.LOUNGE:                "#FFEDD5",  # orange-100
    SpaceType.RECEPTION:             "#F1F5F9",  # slate-100
    SpaceType.PANTRY:                "#DCFCE7",  # green-100
    SpaceType.PHONE_BOOTH:           "#E0F2FE",  # sky-100
    SpaceType.COPY_PRINT:            "#F5F5F4",  # stone-100
    SpaceType.STORAGE:               "#F3F4F6",  # gray-100
    SpaceType.WELLNESS_ROOM:         "#FDF4FF",  # fuchsia-50
    SpaceType.CIRCULATION:           "#F8FAFC",  # slate-50
}

SYSTEM_PROMPT = """You are an expert workplace interior designer and space planner with 20+ years
of experience designing offices for global corporations. You have deep knowledge of:

- WELL Building Standard and BREEAM requirements
- Activity-Based Working (ABW), hybrid, and traditional workplace models
- Human-centred design principles (biophilic design, neurodiversity-friendly spaces)
- International standards: BCO (British Council for Offices), RICS, ADA/DDA compliance
- Efficient furniture layouts: desk clusters, meeting room configurations, collaboration zones
- Circulation planning, wayfinding, and emergency egress
- Acoustic zoning (loud/quiet/private)
- Natural light optimisation (workstations within 6m of facade)
- Sustainable, flexible, and future-proofed workplace design

When given a floor plan analysis and client requirements, you produce:
1. A structured JSON layout plan with precise space allocations
2. Furniture placement coordinates (relative to bounding box)
3. Zone definitions with colour coding
4. Design rationale and recommendations

CRITICAL OUTPUT FORMAT: You must respond with a single valid JSON object matching the schema provided.
Do NOT include any markdown code fences, prose, or text outside the JSON."""

LAYOUT_SCHEMA = {
    "type": "object",
    "required": ["spaces", "zones", "furniture", "ai_rationale", "ai_recommendations", "design_principles"],
    "properties": {
        "spaces": {
            "type": "array",
            "description": "List of space allocations in the layout",
            "items": {
                "type": "object",
                "required": ["id", "space_type", "label", "vertices", "area", "capacity", "color", "zone"],
                "properties": {
                    "id": {"type": "string"},
                    "space_type": {"type": "string", "enum": [t.value for t in SpaceType]},
                    "label": {"type": "string"},
                    "vertices": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {"x": {"type": "number"}, "y": {"type": "number"}},
                        },
                    },
                    "area": {"type": "number"},
                    "capacity": {"type": "integer"},
                    "color": {"type": "string"},
                    "zone": {"type": "string"},
                },
            },
        },
        "zones": {
            "type": "array",
            "items": {
                "type": "object",
                "required": ["id", "name", "color", "area", "headcount"],
                "properties": {
                    "id": {"type": "string"},
                    "name": {"type": "string"},
                    "color": {"type": "string"},
                    "department": {"type": "string"},
                    "area": {"type": "number"},
                    "headcount": {"type": "integer"},
                },
            },
        },
        "furniture": {
            "type": "array",
            "items": {
                "type": "object",
                "required": ["id", "space_type", "label", "x", "y", "width", "height"],
                "properties": {
                    "id": {"type": "string"},
                    "space_type": {"type": "string"},
                    "label": {"type": "string"},
                    "x": {"type": "number"},
                    "y": {"type": "number"},
                    "width": {"type": "number"},
                    "height": {"type": "number"},
                    "rotation": {"type": "number"},
                    "color": {"type": "string"},
                    "capacity": {"type": "integer"},
                    "zone": {"type": "string"},
                },
            },
        },
        "ai_rationale": {"type": "string"},
        "ai_recommendations": {"type": "array", "items": {"type": "string"}},
        "design_principles": {"type": "array", "items": {"type": "string"}},
        "warnings": {"type": "array", "items": {"type": "string"}},
    },
}


def _build_layout_prompt(analysis: dict) -> str:
    fp = analysis["floor_plan"]
    prog = analysis["space_program"]
    req = analysis["client_requirements"]
    fit = analysis["fit_assessment"]
    principles = analysis["design_principles"]

    # Normalise coordinates for AI (0-100 percentage space)
    return f"""## FLOOR PLAN BRIEF

### Building Data
- Gross area: {fp['gross_area_sqm']} m²
- Usable (net) area: {fp['usable_area_sqm']} m²
- Core area (stairs/lifts/bathrooms): {fp['core_area_sqm']} m²
- Floor dimensions: {fp['floor_width_m']}m wide × {fp['floor_depth_m']}m deep
- Orientation: {fp['orientation']} (aspect ratio {fp['aspect_ratio']}:1)
- Natural light perimeter zone: {fp['perimeter_area_sqm']} m²
- Internal core zone: {fp['core_zone_area_sqm']} m²
- Detected rooms: {fp['rooms_detected']}
- Core elements: {json.dumps(fp['core_elements'])}
- File warnings: {json.dumps(fp['warnings'])}

### Space Programme
{json.dumps(prog, indent=2)}

### Fit Assessment
Status: {fit['status']}
{fit['message']}
Recommendation: {fit['recommendation']}

### Client Requirements
- Industry: {req['industry']}
- Headcount: {req['headcount']} people
- Work style: {req['work_style']}
- Density: {req['density']}
- Design style: {req['design_style']}
- Departments: {json.dumps(req['departments']) if req['departments'] else 'Not specified — use open plan zones'}
- Special spaces required: {json.dumps(req['special_spaces'])}
- Special requirements: {req['special_requirements'] or 'None'}

### Design Principles to Apply
{chr(10).join(f"• {p}" for p in principles)}

---

## YOUR TASK

Generate a complete office interior layout for the above floor plan.

COORDINATE SYSTEM: Use normalised coordinates where:
- x: 0 = left wall, 100 = right wall
- y: 0 = bottom wall, 100 = top wall
(Scales to actual {fp['floor_width_m']}m × {fp['floor_depth_m']}m floor)

LAYOUT RULES:
1. Place workstations along the PERIMETER (within 25% of any outer wall) to maximise natural light
2. Place enclosed meeting rooms and core support spaces in the INTERNAL zone (25-75% from walls)
3. Reception should be near the main entry (assume bottom-centre of floor plate)
4. Pantry/lounge should be central and visible to encourage use
5. Phone booths should be distributed throughout the workstation clusters
6. Maintain clear circulation corridors (min 1.5m wide = ~2-3% of floor width)
7. Boardroom near reception, large meeting rooms near reception area
8. Wellness/mothers room should be near core/bathrooms for privacy
9. Focus pods distributed throughout — at least 50% near quiet workstation zones

SPACE VERTICES: Define each space as a rectangular polygon using 4 vertices in clockwise order.
All spaces combined should cover approximately {fp['usable_area_sqm']}m² total.

FURNITURE: Place key furniture items within each space:
- Desks: 1.6m × 0.8m each (use percentage coords scaled to floor)
- Meeting tables: varies by room size
- Lounge chairs/sofas for breakout/lounge areas
- Reception desk for reception area

ZONES: Create 3-6 logical zones (e.g., "Collaboration Hub", "Focus Quarter", "Social Heart",
"Leadership Suite", "Department A", etc.) that group related spaces.

Return the complete layout as a JSON object matching the exact schema below.
Include at minimum:
- All spaces from the space programme
- At least 20 furniture items (desks, tables, chairs, etc.)
- At least 3 zones
- A detailed ai_rationale (min 150 words) explaining key design decisions
- At least 5 ai_recommendations for the client
- At least 4 design_principles applied

JSON SCHEMA:
{json.dumps(LAYOUT_SCHEMA, indent=2)}"""


async def generate_layout_stream(
    fp: FloorPlanData,
    requirements: ClientRequirements,
) -> AsyncIterator[str]:
    """
    Stream the AI layout generation, yielding SSE-compatible chunks.
    """
    analysis = analyze_floor_plan(fp, requirements)
    prompt = _build_layout_prompt(analysis)

    client = anthropic.AsyncAnthropic()

    async with client.messages.stream(
        model="claude-opus-4-6",
        max_tokens=8192,
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": prompt}],
    ) as stream:
        async for text in stream.text_stream:
            yield text


async def generate_layout(
    fp: FloorPlanData,
    requirements: ClientRequirements,
) -> GeneratedLayout:
    """
    Generate a complete office layout using Claude AI.
    Returns a structured GeneratedLayout.
    """
    analysis = analyze_floor_plan(fp, requirements)
    prompt = _build_layout_prompt(analysis)

    client = anthropic.AsyncAnthropic()

    # Use streaming to avoid timeouts on complex layouts
    full_text = ""
    async with client.messages.stream(
        model="claude-opus-4-6",
        max_tokens=8192,
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": prompt}],
    ) as stream:
        async for text in stream.text_stream:
            full_text += text

    # Parse JSON response
    layout_data = _parse_layout_json(full_text)

    # Assign default colours if missing
    for space in layout_data.get("spaces", []):
        if not space.get("color"):
            st = SpaceType(space["space_type"]) if space.get("space_type") in [t.value for t in SpaceType] else SpaceType.WORKSTATION
            space["color"] = SPACE_COLOURS.get(st, "#E5E7EB")

    # Build model objects
    spaces = [SpaceAllocation(**s) for s in layout_data.get("spaces", [])]
    zones = [LayoutZone(**z) for z in layout_data.get("zones", [])]
    furniture = [FurnitureItem(**f) for f in layout_data.get("furniture", [])]

    # Compute statistics
    stats = _compute_statistics(spaces, requirements, fp)

    return GeneratedLayout(
        layout_id=str(uuid.uuid4())[:8],
        floor_plan_id=fp.file_name,
        requirements=requirements,
        spaces=spaces,
        zones=zones,
        furniture=furniture,
        statistics=stats,
        ai_rationale=layout_data.get("ai_rationale", ""),
        ai_recommendations=layout_data.get("ai_recommendations", []),
        design_principles=layout_data.get("design_principles", []),
        warnings=layout_data.get("warnings", []) + fp.warnings,
    )


def _parse_layout_json(text: str) -> dict:
    """Extract and parse JSON from Claude's response."""
    # Strip any accidental markdown fences
    text = text.strip()
    if text.startswith("```"):
        lines = text.split("\n")
        text = "\n".join(lines[1:])
        if text.rstrip().endswith("```"):
            text = text.rstrip()[:-3]

    try:
        return json.loads(text)
    except json.JSONDecodeError:
        # Try to extract JSON object
        start = text.find("{")
        end = text.rfind("}") + 1
        if start != -1 and end > start:
            try:
                return json.loads(text[start:end])
            except json.JSONDecodeError:
                pass

    logger.warning("Could not parse AI JSON response, returning fallback layout")
    return _fallback_layout()


def _fallback_layout() -> dict:
    """Minimal fallback layout if AI response cannot be parsed."""
    return {
        "spaces": [
            {
                "id": "ws-1",
                "space_type": "workstation",
                "label": "Open Workstation Area",
                "vertices": [
                    {"x": 5, "y": 5}, {"x": 50, "y": 5},
                    {"x": 50, "y": 95}, {"x": 5, "y": 95},
                ],
                "area": 0,
                "capacity": 30,
                "color": SPACE_COLOURS[SpaceType.WORKSTATION],
                "zone": "Work Zone",
            },
        ],
        "zones": [
            {"id": "z-1", "name": "Work Zone", "color": "#DBEAFE", "area": 0, "headcount": 30},
        ],
        "furniture": [],
        "ai_rationale": "Layout generated with default configuration. "
                        "Please re-generate for a more detailed layout.",
        "ai_recommendations": ["Configure your ANTHROPIC_API_KEY for full AI layout generation."],
        "design_principles": ["Open plan layout"],
        "warnings": ["AI layout generation failed — showing fallback layout."],
    }


def _compute_statistics(
    spaces: list[SpaceAllocation],
    req: ClientRequirements,
    fp: FloorPlanData,
) -> LayoutStatistics:
    desk_area = sum(s.area for s in spaces if s.space_type == SpaceType.WORKSTATION)
    meeting_rooms = {
        "small": sum(1 for s in spaces if s.space_type == SpaceType.MEETING_ROOM_SMALL),
        "medium": sum(1 for s in spaces if s.space_type == SpaceType.MEETING_ROOM_MEDIUM),
        "large": sum(1 for s in spaces if s.space_type == SpaceType.MEETING_ROOM_LARGE),
        "boardroom": sum(1 for s in spaces if s.space_type == SpaceType.BOARDROOM),
        "phone_booth": sum(1 for s in spaces if s.space_type == SpaceType.PHONE_BOOTH),
    }
    meeting_capacity = sum(s.capacity for s in spaces if s.space_type in (
        SpaceType.MEETING_ROOM_SMALL, SpaceType.MEETING_ROOM_MEDIUM,
        SpaceType.MEETING_ROOM_LARGE, SpaceType.BOARDROOM,
    ))
    collab_sqm = sum(s.area for s in spaces if s.space_type in (
        SpaceType.COLLABORATION, SpaceType.BREAKOUT, SpaceType.LOUNGE,
    ))
    focus_sqm = sum(s.area for s in spaces if s.space_type in (
        SpaceType.FOCUS_POD, SpaceType.PHONE_BOOTH,
    ))
    amenity_sqm = sum(s.area for s in spaces if s.space_type in (
        SpaceType.PANTRY, SpaceType.RECEPTION, SpaceType.WELLNESS_ROOM,
    ))
    circ_sqm = sum(s.area for s in spaces if s.space_type == SpaceType.CIRCULATION)
    usable = fp.usable_area or 1

    desks = sum(s.capacity for s in spaces if s.space_type == SpaceType.WORKSTATION)
    people = req.headcount or 1
    total_meeting_rooms = sum(v for v in meeting_rooms.values() if isinstance(v, int))

    wellness_score = min(100, int(
        20 * (collab_sqm / max(usable, 1) / 0.10) +   # collaboration %
        20 * (focus_sqm / max(usable, 1) / 0.05) +    # focus %
        20 * (amenity_sqm / max(usable, 1) / 0.08) +  # amenity %
        20 * min(1, (desk_area / max(usable, 1)) / 0.40) +  # not over-dense
        20 * min(1, meeting_rooms.get("phone_booth", 0) / max(people / 15, 1))
    ))

    efficiency_score = min(100, int(
        (desk_area + collab_sqm + amenity_sqm) / max(usable, 1) * 100
    ))

    return LayoutStatistics(
        total_desks=desks,
        total_meeting_capacity=meeting_capacity,
        meeting_rooms=meeting_rooms,
        collaboration_sqm=round(collab_sqm, 1),
        focus_sqm=round(focus_sqm, 1),
        amenity_sqm=round(amenity_sqm, 1),
        desk_sqm=round(desk_area, 1),
        circulation_sqm=round(circ_sqm, 1),
        usable_sqm=round(usable, 1),
        sqm_per_person=round(usable / people, 1),
        desk_ratio=round(desks / people, 2) if people else 0,
        meeting_rooms_per_100_people=round(total_meeting_rooms / people * 100, 1),
        phone_booths_per_100_people=round(meeting_rooms.get("phone_booth", 0) / people * 100, 1),
        wellness_score=wellness_score,
        efficiency_score=efficiency_score,
        collaboration_score=min(100, int(collab_sqm / max(usable, 1) * 400)),
    )
