from pydantic import BaseModel, Field
from typing import Optional
from enum import Enum


class EntityType(str, Enum):
    WALL = "wall"
    COLUMN = "column"
    DOOR = "door"
    WINDOW = "window"
    CORE = "core"
    UNKNOWN = "unknown"


class Point(BaseModel):
    x: float
    y: float


class BoundingBox(BaseModel):
    min_x: float
    min_y: float
    max_x: float
    max_y: float

    @property
    def width(self) -> float:
        return self.max_x - self.min_x

    @property
    def height(self) -> float:
        return self.max_y - self.min_y

    @property
    def area(self) -> float:
        return self.width * self.height


class WallSegment(BaseModel):
    start: Point
    end: Point
    thickness: float = 0.15  # metres
    layer: str = ""


class Room(BaseModel):
    id: str
    vertices: list[Point]
    area: float  # sq metres
    perimeter: float
    centroid: Point
    label: str = "Space"
    room_type: str = "open"  # open, enclosed, core
    aspect_ratio: float = 1.0


class CoreElement(BaseModel):
    id: str
    element_type: str  # elevator, stair, bathroom, mechanical, void
    vertices: list[Point]
    area: float
    centroid: Point
    label: str = ""


class FloorPlanData(BaseModel):
    file_name: str
    file_format: str  # dwg or dxf
    bounding_box: BoundingBox
    scale_factor: float = 1.0  # pixels per metre
    total_area: float  # gross sq metres
    usable_area: float  # net usable sq metres
    core_area: float
    walls: list[WallSegment] = []
    rooms: list[Room] = []
    core_elements: list[CoreElement] = []
    columns: list[Point] = []
    doors: list[dict] = []
    windows: list[dict] = []
    # Raw SVG path data for rendering
    wall_paths: list[str] = []
    floor_outline: list[Point] = []
    layers: list[str] = []
    unit: str = "metres"
    warnings: list[str] = []
