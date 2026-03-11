"""
DWG/DXF Floor Plan Parser
Parses AutoCAD DWG/DXF files to extract architectural elements:
- Walls (LINE, LWPOLYLINE, POLYLINE entities on wall layers)
- Rooms/Spaces (closed polylines)
- Core elements (stairs, elevators, bathrooms)
- Columns, doors, windows
"""

import io
import math
import uuid
import logging
from pathlib import Path
from typing import Optional

import ezdxf
import numpy as np
from shapely.geometry import Polygon, LineString, MultiPolygon, Point as SPoint
from shapely.ops import unary_union, polygonize
from shapely import affinity

from models.floor_plan import (
    FloorPlanData, WallSegment, Room, CoreElement,
    BoundingBox, Point
)

logger = logging.getLogger(__name__)

# Layer name patterns for detection (case-insensitive)
WALL_LAYERS = ["wall", "walls", "a-wall", "arch-wall", "partition", "a-glaz"]
CORE_LAYERS = ["core", "stair", "elevator", "lift", "toilet", "wc", "service", "mech"]
COLUMN_LAYERS = ["column", "col", "struct", "a-col", "s-col"]
DOOR_LAYERS = ["door", "a-door", "opening"]
WINDOW_LAYERS = ["window", "a-wind", "glaz", "glazing"]

# Minimum wall length to include (metres)
MIN_WALL_LENGTH = 0.1


def _layer_matches(layer_name: str, patterns: list[str]) -> bool:
    name = layer_name.lower()
    return any(p in name for p in patterns)


def _points_to_model(pts) -> list[Point]:
    return [Point(x=float(p[0]), y=float(p[1])) for p in pts]


def _polygon_area_sqm(polygon: Polygon, scale: float) -> float:
    """Calculate polygon area in square metres."""
    return abs(polygon.area) / (scale * scale)


def _calculate_scale(bbox: BoundingBox, raw_units: str) -> float:
    """
    Estimate scale factor (drawing units per metre).
    Most architectural DXF files use millimetres or metres.
    """
    width = bbox.max_x - bbox.min_x
    height = bbox.max_y - bbox.min_y
    max_dim = max(width, height)

    # Heuristic: if max dimension > 1000, likely millimetres
    if max_dim > 500:
        return 1000.0  # mm → m
    elif max_dim > 10:
        return 1.0  # already metres
    else:
        return 0.3048  # feet → m


def _safe_error_msg(e: Exception, filename: str) -> str:
    """Return a printable error message, stripping any binary content."""
    try:
        raw = str(e)
        # If the message contains non-printable bytes it's binary garbage — discard it
        printable = "".join(c for c in raw if c.isprintable() or c in " \t\n")
        if len(printable) > 20:
            return printable[:300]
    except Exception:
        pass
    return (
        f"Cannot read '{filename}'. The file may be corrupted or use an unsupported format. "
        f"Please save as DXF R2010 from AutoCAD and upload the .dxf file."
    )


def parse_dwg_file(file_content: bytes, filename: str) -> FloorPlanData:
    """
    Main entry point: parse DWG or DXF file bytes into FloorPlanData.
    For DWG files, ezdxf can handle R2004 and newer. Older DWG files
    should be converted to DXF first.
    """
    try:
        return _parse_dwg_file(file_content, filename)
    except ValueError:
        raise  # already a friendly message — pass through
    except Exception as e:
        raise ValueError(_safe_error_msg(e, filename))


def _parse_dwg_file(file_content: bytes, filename: str) -> FloorPlanData:
    """Internal parser — called by parse_dwg_file which handles all exceptions."""
    warnings = []
    suffix = Path(filename).suffix.lower()

    try:
        if suffix == ".dxf":
            # DXF is a text format — ezdxf.read() requires a text stream
            try:
                text = file_content.decode("utf-8")
            except UnicodeDecodeError:
                text = file_content.decode("latin-1")
            stream = io.StringIO(text)
        else:
            # DWG is binary
            stream = io.BytesIO(file_content)
        doc = ezdxf.read(stream)
    except ezdxf.DXFStructureError:
        raise ValueError(
            f"Cannot parse '{filename}'. This file format is not supported. "
            f"Please open it in AutoCAD, then Save As → DXF R2010 format, "
            f"and upload the .dxf file instead."
        )
    except Exception:
        raise ValueError(
            f"Cannot read '{filename}'. The file may be corrupted or in an unsupported DWG version. "
            f"Please save as DXF R2010 from AutoCAD and upload the .dxf file."
        )

    msp = doc.modelspace()
    layers = [layer.dxf.name for layer in doc.layers]

    # Collect all geometry entities
    all_lines: list[tuple] = []        # (start, end, layer)
    all_polylines: list[list] = []     # [(pts, is_closed, layer)]

    MAX_ENTITIES = 50_000
    entity_count = 0
    for entity in msp:
        if entity_count >= MAX_ENTITIES:
            warnings.append(
                f"File has more than {MAX_ENTITIES} entities; only the first "
                f"{MAX_ENTITIES} were processed for performance."
            )
            break
        entity_count += 1
        try:
            layer = entity.dxf.layer if hasattr(entity.dxf, "layer") else "0"
            etype = entity.dxftype()

            if etype == "LINE":
                s = entity.dxf.start
                e = entity.dxf.end
                all_lines.append(((s.x, s.y), (e.x, e.y), layer))

            elif etype in ("LWPOLYLINE", "POLYLINE", "POLYLINE2D"):
                try:
                    pts = [(p[0], p[1]) for p in entity.get_points()]
                    if len(pts) >= 2:
                        closed = entity.is_closed if hasattr(entity, "is_closed") else False
                        all_polylines.append((pts, closed, layer))
                except Exception:
                    pass

            elif etype == "SPLINE":
                try:
                    pts = [(p[0], p[1]) for p in entity.flattening(1.0)]
                    if len(pts) >= 2:
                        all_polylines.append((pts, False, layer))
                except Exception:
                    pass

            elif etype == "ARC":
                try:
                    pts = _arc_to_points(entity)
                    if pts:
                        all_polylines.append((pts, False, layer))
                except Exception:
                    pass

        except Exception as ex:
            logger.debug(f"Skipping entity {entity.dxftype()}: {ex}")

    # Build bounding box from all points
    all_pts = (
        [s for s, e, _ in all_lines] +
        [e for s, e, _ in all_lines] +
        [p for pts, _, _ in all_polylines for p in pts]
    )

    if not all_pts:
        raise ValueError("No drawable geometry found in the file. "
                         "Ensure the file contains floor plan entities.")

    xs = [p[0] for p in all_pts]
    ys = [p[1] for p in all_pts]
    bbox = BoundingBox(
        min_x=min(xs), min_y=min(ys),
        max_x=max(xs), max_y=max(ys)
    )

    scale = _calculate_scale(bbox, "auto")
    gross_area_sqm = (bbox.max_x - bbox.min_x) * (bbox.max_y - bbox.min_y) / (scale * scale)

    # Detect walls
    walls = _detect_walls(all_lines, all_polylines, scale)

    # Detect rooms from closed polylines
    rooms, core_elements = _detect_rooms_and_cores(all_polylines, scale, bbox)

    # Detect columns
    columns = _detect_columns(all_lines, all_polylines)

    # Calculate areas
    core_area = sum(c.area for c in core_elements)
    usable_area = max(0, gross_area_sqm * 0.85 - core_area)

    # Generate floor outline
    floor_outline = _get_floor_outline(all_polylines, bbox)

    if not rooms:
        warnings.append(
            "No clearly defined rooms detected. The layout will be generated "
            "based on the overall floor plate boundary. "
            "For better results, ensure room polylines are closed on dedicated layers."
        )

    return FloorPlanData(
        file_name=filename,
        file_format=suffix.lstrip("."),
        bounding_box=bbox,
        scale_factor=scale,
        total_area=round(gross_area_sqm, 1),
        usable_area=round(usable_area, 1),
        core_area=round(core_area, 1),
        walls=walls[:500],  # cap for performance
        rooms=rooms,
        core_elements=core_elements,
        columns=columns[:200],
        floor_outline=floor_outline,
        layers=layers,
        unit="metres",
        warnings=warnings,
    )


def _arc_to_points(entity, num_points: int = 16) -> list[tuple]:
    """Convert ARC entity to list of points."""
    try:
        cx, cy = entity.dxf.center.x, entity.dxf.center.y
        r = entity.dxf.radius
        start_deg = entity.dxf.start_angle
        end_deg = entity.dxf.end_angle
        if end_deg < start_deg:
            end_deg += 360
        angles = np.linspace(math.radians(start_deg), math.radians(end_deg), num_points)
        return [(cx + r * math.cos(a), cy + r * math.sin(a)) for a in angles]
    except Exception:
        return []


def _detect_walls(
    lines: list[tuple],
    polylines: list[tuple],
    scale: float
) -> list[WallSegment]:
    """Extract wall segments from LINE and POLYLINE entities."""
    walls = []

    for start, end, layer in lines:
        length = math.hypot(end[0] - start[0], end[1] - start[1]) / scale
        if length < MIN_WALL_LENGTH:
            continue
        is_wall = _layer_matches(layer, WALL_LAYERS) or layer in ("0", "DEFPOINTS")
        if is_wall or length > 0.5:  # Include longer lines even on unknown layers
            walls.append(WallSegment(
                start=Point(x=start[0], y=start[1]),
                end=Point(x=end[0], y=end[1]),
                layer=layer,
            ))

    for pts, closed, layer in polylines:
        is_wall = _layer_matches(layer, WALL_LAYERS)
        if not is_wall:
            continue
        for i in range(len(pts) - 1):
            s, e = pts[i], pts[i + 1]
            length = math.hypot(e[0] - s[0], e[1] - s[1]) / scale
            if length >= MIN_WALL_LENGTH:
                walls.append(WallSegment(
                    start=Point(x=s[0], y=s[1]),
                    end=Point(x=e[0], y=e[1]),
                    layer=layer,
                ))
        if closed and len(pts) >= 3:
            s, e = pts[-1], pts[0]
            walls.append(WallSegment(
                start=Point(x=s[0], y=s[1]),
                end=Point(x=e[0], y=e[1]),
                layer=layer,
            ))

    return walls


def _detect_rooms_and_cores(
    polylines: list[tuple],
    scale: float,
    bbox: BoundingBox,
) -> tuple[list[Room], list[CoreElement]]:
    """
    Detect rooms and core elements from closed polylines.
    Uses area thresholds and layer names to classify spaces.
    """
    rooms = []
    core_elements = []
    gross_area = (bbox.max_x - bbox.min_x) * (bbox.max_y - bbox.min_y)

    for pts, closed, layer in polylines:
        if not closed or len(pts) < 3:
            continue

        try:
            poly = Polygon(pts)
            if not poly.is_valid:
                poly = poly.buffer(0)
            if poly.area < 0.01 * gross_area * 0.001:
                continue  # too tiny

            area_sqm = poly.area / (scale * scale)
            if area_sqm < 0.5:
                continue  # ignore sub-0.5m² polygons

            centroid = poly.centroid
            perimeter = poly.length / scale
            vertices = _points_to_model(list(poly.exterior.coords)[:-1])
            cx = Point(x=centroid.x, y=centroid.y)

            # Aspect ratio — skip expensive MBR for complex polygons
            if len(pts) <= 20:
                try:
                    mbr = poly.minimum_rotated_rectangle
                    mbr_coords = list(mbr.exterior.coords)
                    w = math.hypot(mbr_coords[1][0] - mbr_coords[0][0], mbr_coords[1][1] - mbr_coords[0][1])
                    h = math.hypot(mbr_coords[2][0] - mbr_coords[1][0], mbr_coords[2][1] - mbr_coords[1][1])
                    aspect = max(w, h) / max(min(w, h), 0.01)
                except Exception:
                    aspect = 1.0
            else:
                # Approximate via bounding box
                env = poly.envelope
                env_coords = list(env.exterior.coords)
                w = abs(env_coords[2][0] - env_coords[0][0])
                h = abs(env_coords[2][1] - env_coords[0][1])
                aspect = max(w, h) / max(min(w, h), 0.01)

            is_core = _layer_matches(layer, CORE_LAYERS)
            is_large = area_sqm > gross_area / (scale * scale) * 0.3

            if is_core or (area_sqm < 20 and not is_large):
                etype = _classify_core_element(layer, area_sqm)
                core_elements.append(CoreElement(
                    id=str(uuid.uuid4())[:8],
                    element_type=etype,
                    vertices=vertices,
                    area=round(area_sqm, 2),
                    centroid=cx,
                    label=_core_label(etype),
                ))
            else:
                rtype = "enclosed" if area_sqm < 50 else "open"
                rooms.append(Room(
                    id=str(uuid.uuid4())[:8],
                    vertices=vertices,
                    area=round(area_sqm, 1),
                    perimeter=round(perimeter, 1),
                    centroid=cx,
                    room_type=rtype,
                    aspect_ratio=round(aspect, 2),
                ))
        except Exception as ex:
            logger.debug(f"Skipping polyline room: {ex}")

    return rooms, core_elements


def _classify_core_element(layer: str, area_sqm: float) -> str:
    name = layer.lower()
    if any(k in name for k in ["stair", "step"]):
        return "stair"
    if any(k in name for k in ["lift", "elev"]):
        return "elevator"
    if any(k in name for k in ["toilet", "wc", "bath", "wash"]):
        return "bathroom"
    if any(k in name for k in ["mech", "service", "plant"]):
        return "mechanical"
    if area_sqm < 5:
        return "void"
    return "core"


def _core_label(etype: str) -> str:
    labels = {
        "stair": "Stairwell",
        "elevator": "Elevator",
        "bathroom": "Bathroom",
        "mechanical": "Mechanical",
        "void": "Void",
        "core": "Core",
    }
    return labels.get(etype, "Core")


def _detect_columns(
    lines: list[tuple],
    polylines: list[tuple],
) -> list[Point]:
    """Detect structural columns (typically small closed squares/rectangles)."""
    columns = []
    for pts, closed, layer in polylines:
        if not closed or len(pts) < 3:
            continue
        if not _layer_matches(layer, COLUMN_LAYERS) and not any(k in layer.lower() for k in ["col", "struct"]):
            continue
        try:
            poly = Polygon(pts)
            area = poly.area
            # Columns are typically small (0.3x0.3 to 1x1 m)
            if area < 10000:  # rough threshold in drawing units
                centroid = poly.centroid
                columns.append(Point(x=centroid.x, y=centroid.y))
        except Exception:
            pass
    return columns


def _get_floor_outline(polylines: list[tuple], bbox: BoundingBox) -> list[Point]:
    """Find the largest closed polyline to use as floor outline."""
    largest_area = 0
    largest_pts = None

    for pts, closed, layer in polylines:
        if not closed or len(pts) < 3:
            continue
        try:
            poly = Polygon(pts)
            if poly.area > largest_area:
                largest_area = poly.area
                largest_pts = list(poly.exterior.coords)[:-1]
        except Exception:
            pass

    if largest_pts:
        return _points_to_model(largest_pts)

    # Fallback: use bounding box
    return [
        Point(x=bbox.min_x, y=bbox.min_y),
        Point(x=bbox.max_x, y=bbox.min_y),
        Point(x=bbox.max_x, y=bbox.max_y),
        Point(x=bbox.min_x, y=bbox.max_y),
    ]
