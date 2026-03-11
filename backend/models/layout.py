from pydantic import BaseModel, Field
from typing import Optional
from enum import Enum


class SpaceType(str, Enum):
    WORKSTATION = "workstation"
    PRIVATE_OFFICE = "private_office"
    MEETING_ROOM_SMALL = "meeting_room_small"  # 4-6 pax
    MEETING_ROOM_MEDIUM = "meeting_room_medium"  # 8-12 pax
    MEETING_ROOM_LARGE = "meeting_room_large"  # 12-20 pax
    BOARDROOM = "boardroom"
    COLLABORATION = "collaboration"
    FOCUS_POD = "focus_pod"
    BREAKOUT = "breakout"
    LOUNGE = "lounge"
    RECEPTION = "reception"
    PANTRY = "pantry"
    PHONE_BOOTH = "phone_booth"
    COPY_PRINT = "copy_print"
    STORAGE = "storage"
    WELLNESS_ROOM = "wellness_room"
    CIRCULATION = "circulation"


class WorkstationDensity(str, Enum):
    DENSE = "dense"       # 7 sqm/person
    STANDARD = "standard"  # 10 sqm/person
    SPACIOUS = "spacious"  # 14 sqm/person
    EXECUTIVE = "executive"  # 18 sqm/person


class WorkStyle(str, Enum):
    ACTIVITY_BASED = "activity_based"   # ABW - no assigned desks
    HYBRID = "hybrid"                    # Mix of assigned + flexible
    TRADITIONAL = "traditional"          # Assigned desks
    HOT_DESKING = "hot_desking"         # Pure hot-desking


class ClientRequirements(BaseModel):
    headcount: int = Field(default=50, ge=1, le=2000, description="Total number of people")
    desk_sharing_ratio: float = Field(default=0.8, ge=0.3, le=1.0, description="Ratio of desks to people (0.8 = 80%)")
    work_style: WorkStyle = WorkStyle.HYBRID
    density: WorkstationDensity = WorkstationDensity.STANDARD

    # Room allocations (% of usable area)
    meeting_room_percent: float = Field(default=15.0, ge=5.0, le=35.0)
    collaboration_percent: float = Field(default=10.0, ge=0.0, le=30.0)
    focus_percent: float = Field(default=5.0, ge=0.0, le=20.0)
    amenity_percent: float = Field(default=8.0, ge=3.0, le=20.0)  # pantry, lounge, etc.

    # Room counts (0 = auto-calculate)
    small_meeting_rooms: int = 0
    medium_meeting_rooms: int = 0
    large_meeting_rooms: int = 0
    phone_booths: int = 0
    focus_pods: int = 0

    # Special spaces
    has_reception: bool = True
    has_boardroom: bool = True
    has_wellness_room: bool = False
    has_mothers_room: bool = False
    has_server_room: bool = False

    # Style preferences
    industry: str = "technology"
    design_style: str = "modern"  # modern, biophilic, traditional, creative
    primary_color: str = "#2563EB"
    accent_color: str = "#10B981"

    # Department zones
    departments: list[dict] = []  # [{name, headcount, adjacency_requirements}]

    # Additional notes for AI
    special_requirements: str = ""


class FurnitureItem(BaseModel):
    id: str
    space_type: SpaceType
    label: str
    x: float
    y: float
    width: float
    height: float
    rotation: float = 0.0
    color: str = "#E5E7EB"
    capacity: int = 1
    zone: str = ""


class SpaceAllocation(BaseModel):
    id: str
    space_type: SpaceType
    label: str
    vertices: list[dict]  # [{x, y}]
    area: float
    capacity: int
    color: str
    zone: str = ""
    furniture: list[FurnitureItem] = []


class LayoutZone(BaseModel):
    id: str
    name: str
    color: str
    department: str = ""
    space_types: list[SpaceType] = []
    area: float = 0.0
    headcount: int = 0


class LayoutStatistics(BaseModel):
    total_desks: int
    total_meeting_capacity: int
    meeting_rooms: dict[str, int]  # type -> count
    collaboration_sqm: float
    focus_sqm: float
    amenity_sqm: float
    desk_sqm: float
    circulation_sqm: float
    usable_sqm: float
    sqm_per_person: float
    desk_ratio: float
    meeting_rooms_per_100_people: float
    phone_booths_per_100_people: float
    wellness_score: int  # 0-100
    efficiency_score: int  # 0-100
    collaboration_score: int  # 0-100


class GeneratedLayout(BaseModel):
    layout_id: str
    floor_plan_id: str
    requirements: ClientRequirements
    spaces: list[SpaceAllocation] = []
    zones: list[LayoutZone] = []
    furniture: list[FurnitureItem] = []
    statistics: Optional[LayoutStatistics] = None
    ai_rationale: str = ""
    ai_recommendations: list[str] = []
    design_principles: list[str] = []
    svg_overlay: str = ""  # SVG markup for the layout overlay
    warnings: list[str] = []
    version: int = 1
