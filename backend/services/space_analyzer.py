"""
Space Analyzer
Analyzes the parsed floor plan geometry to produce a structured
summary suitable for AI-based layout generation.
Computes: adjacency graph, natural light access, circulation paths,
zone recommendations, and space programming numbers.
"""

import math
import uuid
from typing import Optional

import numpy as np
from shapely.geometry import Polygon, LineString, MultiPolygon, Point as SPoint
from shapely.ops import unary_union

from models.floor_plan import FloorPlanData, Room, Point, BoundingBox
from models.layout import ClientRequirements, WorkstationDensity


# sq metres per person by density
DENSITY_SQM = {
    WorkstationDensity.DENSE: 7,
    WorkstationDensity.STANDARD: 10,
    WorkstationDensity.SPACIOUS: 14,
    WorkstationDensity.EXECUTIVE: 18,
}

# Standard room sizes (sq metres)
ROOM_SIZES = {
    "phone_booth": 1.5,
    "focus_pod": 4.0,
    "meeting_small": 14.0,   # 4-6 pax, ~2.4x3.6 + circulation
    "meeting_medium": 28.0,  # 8-12 pax
    "meeting_large": 50.0,   # 12-20 pax
    "boardroom": 70.0,
    "reception": 25.0,
    "pantry_small": 15.0,
    "pantry_large": 30.0,
    "lounge": 20.0,
    "wellness": 12.0,
    "mothers_room": 8.0,
    "server_room": 20.0,
}


class SpaceProgram:
    """Computed space program from requirements and floor plan."""

    def __init__(self, fp: FloorPlanData, req: ClientRequirements):
        self.fp = fp
        self.req = req
        self.usable_area = fp.usable_area
        self._compute()

    def _compute(self):
        req = self.req
        usable = self.usable_area

        # Desk count
        desks = int(req.headcount * req.desk_sharing_ratio)
        sqm_per_person = DENSITY_SQM[req.density]
        desk_area = desks * sqm_per_person

        # Meeting rooms (auto-calculate if 0)
        small = req.small_meeting_rooms
        medium = req.medium_meeting_rooms
        large = req.large_meeting_rooms

        if small == 0 and medium == 0 and large == 0:
            people = req.headcount
            small = max(1, int(people / 10))    # 1 per 10 people
            medium = max(1, int(people / 25))
            large = max(0, int(people / 75))

        meeting_area = (
            small * ROOM_SIZES["meeting_small"] +
            medium * ROOM_SIZES["meeting_medium"] +
            large * ROOM_SIZES["meeting_large"] +
            (ROOM_SIZES["boardroom"] if req.has_boardroom else 0)
        )

        # Phone booths and focus pods
        booths = req.phone_booths or max(2, req.headcount // 15)
        pods = req.focus_pods or max(2, req.headcount // 20)

        booth_area = booths * ROOM_SIZES["phone_booth"]
        pod_area = pods * ROOM_SIZES["focus_pod"]

        # Amenities
        reception_area = ROOM_SIZES["reception"] if req.has_reception else 0
        pantry_area = ROOM_SIZES["pantry_large"] if req.headcount > 50 else ROOM_SIZES["pantry_small"]
        lounge_area = ROOM_SIZES["lounge"] * max(1, req.headcount // 50)
        wellness_area = ROOM_SIZES["wellness"] if req.has_wellness_room else 0
        server_area = ROOM_SIZES["server_room"] if req.has_server_room else 0

        # Collaboration
        collab_area = usable * (req.collaboration_percent / 100)

        # Circulation (typically 25-30% of usable)
        programmed = desk_area + meeting_area + booth_area + pod_area + reception_area + \
                     pantry_area + lounge_area + wellness_area + server_area + collab_area
        circulation = usable * 0.25

        # Check if it fits
        total_programmed = programmed + circulation
        fit_ratio = total_programmed / max(usable, 1)

        self.desks = desks
        self.small_meeting_rooms = small
        self.medium_meeting_rooms = medium
        self.large_meeting_rooms = large
        self.phone_booths = booths
        self.focus_pods = pods
        self.desk_area = desk_area
        self.meeting_area = meeting_area
        self.booth_area = booth_area
        self.pod_area = pod_area
        self.reception_area = reception_area
        self.pantry_area = pantry_area
        self.lounge_area = lounge_area
        self.wellness_area = wellness_area
        self.server_area = server_area
        self.collab_area = collab_area
        self.circulation_area = circulation
        self.total_programmed = total_programmed
        self.fit_ratio = fit_ratio
        self.sqm_per_person = sqm_per_person

    def to_dict(self) -> dict:
        return {
            "headcount": self.req.headcount,
            "desks": self.desks,
            "sqm_per_person": self.sqm_per_person,
            "usable_area_sqm": self.usable_area,
            "fit_ratio": round(self.fit_ratio, 2),
            "spaces": {
                "workstations": {"count": self.desks, "area_sqm": round(self.desk_area, 1)},
                "small_meeting_rooms": {"count": self.small_meeting_rooms, "area_sqm": round(self.small_meeting_rooms * ROOM_SIZES["meeting_small"], 1), "capacity": "4-6 pax"},
                "medium_meeting_rooms": {"count": self.medium_meeting_rooms, "area_sqm": round(self.medium_meeting_rooms * ROOM_SIZES["meeting_medium"], 1), "capacity": "8-12 pax"},
                "large_meeting_rooms": {"count": self.large_meeting_rooms, "area_sqm": round(self.large_meeting_rooms * ROOM_SIZES["meeting_large"], 1), "capacity": "12-20 pax"},
                "boardroom": {"count": 1 if self.req.has_boardroom else 0, "area_sqm": ROOM_SIZES["boardroom"] if self.req.has_boardroom else 0},
                "phone_booths": {"count": self.phone_booths, "area_sqm": round(self.booth_area, 1)},
                "focus_pods": {"count": self.focus_pods, "area_sqm": round(self.pod_area, 1)},
                "reception": {"area_sqm": round(self.reception_area, 1)},
                "pantry_lounge": {"area_sqm": round(self.pantry_area + self.lounge_area, 1)},
                "collaboration_zones": {"area_sqm": round(self.collab_area, 1)},
                "wellness": {"area_sqm": round(self.wellness_area, 1)},
            },
            "circulation_area_sqm": round(self.circulation_area, 1),
        }


def analyze_floor_plan(fp: FloorPlanData, req: ClientRequirements) -> dict:
    """
    Full analysis of a floor plan given client requirements.
    Returns a structured dict for the AI layout generator.
    """
    program = SpaceProgram(fp, req)

    # Detect orientation
    bbox = fp.bounding_box
    width = (bbox.max_x - bbox.min_x) / fp.scale_factor
    depth = (bbox.max_y - bbox.min_y) / fp.scale_factor
    orientation = "landscape" if width >= depth else "portrait"
    aspect = round(max(width, depth) / max(min(width, depth), 0.01), 2)

    # Natural light zones (perimeter = within ~6m of exterior)
    perimeter_depth_m = 6.0
    perimeter_depth_units = perimeter_depth_m * fp.scale_factor

    # Build floor outline polygon for zone detection
    floor_pts = [(p.x, p.y) for p in fp.floor_outline]
    if len(floor_pts) >= 3:
        try:
            floor_poly = Polygon(floor_pts)
            # Perimeter zone = area within perimeter_depth of exterior
            interior = floor_poly.buffer(-perimeter_depth_units)
            if interior.is_valid and not interior.is_empty:
                perimeter_poly = floor_poly.difference(interior)
                perimeter_area = perimeter_poly.area / (fp.scale_factor ** 2)
                core_zone_area = interior.area / (fp.scale_factor ** 2)
            else:
                perimeter_area = floor_poly.area / (fp.scale_factor ** 2)
                core_zone_area = 0
        except Exception:
            perimeter_area = fp.usable_area * 0.6
            core_zone_area = fp.usable_area * 0.4
    else:
        perimeter_area = fp.usable_area * 0.6
        core_zone_area = fp.usable_area * 0.4

    # Compute adjacency requirements
    adjacencies = _compute_adjacencies(req)

    return {
        "floor_plan": {
            "file": fp.file_name,
            "gross_area_sqm": fp.total_area,
            "usable_area_sqm": fp.usable_area,
            "core_area_sqm": fp.core_area,
            "floor_width_m": round(width, 1),
            "floor_depth_m": round(depth, 1),
            "orientation": orientation,
            "aspect_ratio": aspect,
            "perimeter_area_sqm": round(perimeter_area, 1),
            "core_zone_area_sqm": round(core_zone_area, 1),
            "rooms_detected": len(fp.rooms),
            "core_elements": [{"type": c.element_type, "label": c.label} for c in fp.core_elements],
            "columns_detected": len(fp.columns),
            "warnings": fp.warnings,
        },
        "space_program": program.to_dict(),
        "client_requirements": {
            "headcount": req.headcount,
            "work_style": req.work_style.value,
            "density": req.density.value,
            "industry": req.industry,
            "design_style": req.design_style,
            "departments": req.departments,
            "special_requirements": req.special_requirements,
            "special_spaces": {
                "reception": req.has_reception,
                "boardroom": req.has_boardroom,
                "wellness_room": req.has_wellness_room,
                "mothers_room": req.has_mothers_room,
                "server_room": req.has_server_room,
            },
        },
        "adjacency_requirements": adjacencies,
        "design_principles": _get_design_principles(req),
        "fit_assessment": _assess_fit(program),
    }


def _compute_adjacencies(req: ClientRequirements) -> list[dict]:
    """Standard workplace adjacency requirements."""
    adj = [
        {"from": "reception", "to": "main_entrance", "priority": "critical"},
        {"from": "reception", "to": "large_meeting_room", "priority": "high"},
        {"from": "pantry", "to": "lounge", "priority": "high"},
        {"from": "phone_booths", "to": "workstations", "priority": "high"},
        {"from": "focus_pods", "to": "workstations", "priority": "medium"},
        {"from": "collaboration_zone", "to": "workstations", "priority": "medium"},
        {"from": "wellness_room", "to": "quiet_area", "priority": "high"},
    ]
    return adj


def _get_design_principles(req: ClientRequirements) -> list[str]:
    """Return relevant design principles based on work style and industry."""
    principles = []

    if req.work_style.value == "activity_based":
        principles += [
            "No assigned workstations — variety of settings for different tasks",
            "Minimum 30% collaboration and social spaces",
            "Highly visible and easily accessible amenities",
            "Clear wayfinding and address system for unassigned spaces",
        ]
    elif req.work_style.value == "hybrid":
        principles += [
            "Mix of assigned and flexible/bookable desks",
            "Neighbourhood team clusters with shared amenities",
            "Technology-enabled bookable spaces",
        ]

    if req.density.value in ("dense", "standard"):
        principles.append("Maximise daylight to workstations — place desks parallel to facade")

    if req.industry == "technology":
        principles += [
            "Focus on collaboration and ideation spaces",
            "Informal social hubs to foster serendipitous interactions",
            "Quiet focus zones for deep work",
        ]
    elif req.industry == "finance":
        principles += [
            "Private offices and secure spaces for confidential discussions",
            "Clean, professional aesthetic",
            "Secure server/IT infrastructure area",
        ]
    elif req.industry in ("creative", "media"):
        principles += [
            "Large open collaborative areas",
            "Flexible, reconfigurable furniture",
            "Inspiration walls and material displays",
        ]

    principles += [
        "Place meeting rooms and enclosed spaces along internal core — preserve perimeter for workstations",
        "Ensure 6m natural light depth for seated workstations",
        "Circulation spine should be clear and unobstructed",
        "Accessibility: ensure DDA-compliant circulation widths (min 1.5m)",
    ]

    return principles


def _assess_fit(program: SpaceProgram) -> dict:
    fit = program.fit_ratio
    if fit <= 0.85:
        status = "comfortable"
        message = f"Programme fits well with {round((1 - fit) * program.usable_area)}m² spare"
    elif fit <= 1.0:
        status = "tight"
        message = "Programme is achievable but layout efficiency will be critical"
    elif fit <= 1.15:
        status = "over_programmed"
        message = f"Programme exceeds floor area by {round((fit - 1) * 100)}% — reduce desk count or room sizes"
    else:
        status = "infeasible"
        message = f"Programme is {round((fit - 1) * 100)}% over capacity — significant reduction required"

    return {
        "status": status,
        "fit_ratio": round(fit, 2),
        "message": message,
        "recommendation": _fit_recommendation(status, program),
    }


def _fit_recommendation(status: str, program: SpaceProgram) -> str:
    if status == "comfortable":
        return "Consider adding more collaboration or breakout spaces to improve workplace experience."
    if status == "tight":
        return "Prioritise efficient furniture specification and minimise non-essential storage."
    if status == "over_programmed":
        recs = []
        if program.req.desk_sharing_ratio > 0.7:
            recs.append("increase desk sharing ratio to 0.6-0.65")
        recs.append("use compact workstation modules (1500x750mm)")
        recs.append("combine small meeting rooms into a multi-purpose space")
        return "To reduce programme: " + "; ".join(recs) + "."
    return "Reduce headcount target or consider a larger floor plate."
