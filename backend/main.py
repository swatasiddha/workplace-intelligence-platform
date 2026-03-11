"""
Workplace Intelligence Platform — FastAPI Backend
AI-powered office interior design from DWG/DXF floor plans
"""

import json
import uuid
import logging
from pathlib import Path

from fastapi import FastAPI, UploadFile, File, HTTPException, Form, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, JSONResponse
from pydantic import ValidationError

from models.floor_plan import FloorPlanData
from models.layout import ClientRequirements, GeneratedLayout
from services.dwg_parser import parse_dwg_file
from services.space_analyzer import analyze_floor_plan
from services.ai_layout_generator import generate_layout, generate_layout_stream

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Workplace Intelligence Platform",
    description="AI-powered office interior design from DWG/DXF floor plans using Claude",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory store (replace with Redis/DB in production)
_floor_plans: dict[str, FloorPlanData] = {}
_layouts: dict[str, GeneratedLayout] = {}

ALLOWED_EXTENSIONS = {".dwg", ".dxf"}
MAX_FILE_SIZE_MB = 50


@app.get("/health")
async def health_check():
    return {"status": "ok", "service": "workplace-intelligence-platform"}


@app.post("/api/upload", summary="Upload DWG/DXF floor plan")
async def upload_floor_plan(file: UploadFile = File(...)):
    """
    Upload an AutoCAD DWG or DXF file.
    Returns parsed floor plan data including walls, rooms, and detected spaces.
    """
    suffix = Path(file.filename or "file.dxf").suffix.lower()
    if suffix not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            400,
            f"Unsupported file format '{suffix}'. Please upload a .DWG or .DXF file.",
        )

    content = await file.read()
    if len(content) > MAX_FILE_SIZE_MB * 1024 * 1024:
        raise HTTPException(413, f"File exceeds {MAX_FILE_SIZE_MB}MB limit.")
    if len(content) == 0:
        raise HTTPException(400, "File is empty.")

    try:
        fp = parse_dwg_file(content, file.filename or "floor_plan.dxf")
    except ValueError as e:
        raise HTTPException(422, str(e))
    except Exception as e:
        logger.exception("Unexpected parse error")
        raise HTTPException(500, f"Failed to parse file: {e}")

    plan_id = str(uuid.uuid4())[:8]
    _floor_plans[plan_id] = fp

    return {
        "plan_id": plan_id,
        "floor_plan": fp.model_dump(),
        "message": "Floor plan parsed successfully.",
    }


@app.get("/api/floor-plan/{plan_id}", summary="Get parsed floor plan")
async def get_floor_plan(plan_id: str):
    fp = _floor_plans.get(plan_id)
    if not fp:
        raise HTTPException(404, "Floor plan not found.")
    return fp.model_dump()


@app.post("/api/analyze/{plan_id}", summary="Analyse floor plan with client requirements")
async def analyze_plan(plan_id: str, requirements: ClientRequirements):
    """
    Analyse the parsed floor plan against client requirements.
    Returns space programme, fit assessment, and design principles.
    """
    fp = _floor_plans.get(plan_id)
    if not fp:
        raise HTTPException(404, "Floor plan not found.")

    analysis = analyze_floor_plan(fp, requirements)
    return analysis


@app.post("/api/generate-layout/{plan_id}", summary="Generate AI layout (streaming)")
async def generate_layout_endpoint(plan_id: str, requirements: ClientRequirements):
    """
    Generate an AI-powered office layout from the floor plan.
    Uses Claude Opus 4.6 with adaptive thinking.
    Returns a complete layout with space allocations, furniture, and recommendations.
    """
    fp = _floor_plans.get(plan_id)
    if not fp:
        raise HTTPException(404, "Floor plan not found.")

    try:
        layout = await generate_layout(fp, requirements)
    except Exception as e:
        logger.exception("Layout generation failed")
        raise HTTPException(500, f"Layout generation failed: {e}")

    layout_id = layout.layout_id
    _layouts[layout_id] = layout

    return {
        "layout_id": layout_id,
        "layout": layout.model_dump(),
        "message": "Layout generated successfully.",
    }


@app.post("/api/generate-layout-stream/{plan_id}", summary="Stream AI layout generation")
async def generate_layout_stream_endpoint(plan_id: str, requirements: ClientRequirements):
    """
    Stream the AI layout generation token by token.
    Returns Server-Sent Events (SSE) stream.
    """
    fp = _floor_plans.get(plan_id)
    if not fp:
        raise HTTPException(404, "Floor plan not found.")

    async def event_stream():
        try:
            async for chunk in generate_layout_stream(fp, requirements):
                yield f"data: {json.dumps({'chunk': chunk})}\n\n"
            yield "data: [DONE]\n\n"
        except Exception as e:
            logger.exception("Stream error")
            yield f"data: {json.dumps({'error': str(e)})}\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


@app.get("/api/layout/{layout_id}", summary="Get generated layout")
async def get_layout(layout_id: str):
    layout = _layouts.get(layout_id)
    if not layout:
        raise HTTPException(404, "Layout not found.")
    return layout.model_dump()


@app.put("/api/layout/{layout_id}", summary="Update layout (customisation)")
async def update_layout(layout_id: str, updates: dict):
    """
    Apply client customisations to an existing layout.
    Accepts partial updates to spaces, furniture, or zone assignments.
    """
    layout = _layouts.get(layout_id)
    if not layout:
        raise HTTPException(404, "Layout not found.")

    layout_dict = layout.model_dump()
    layout_dict.update(updates)

    try:
        updated = GeneratedLayout(**layout_dict)
    except ValidationError as e:
        raise HTTPException(422, str(e))

    _layouts[layout_id] = updated
    return {"layout_id": layout_id, "layout": updated.model_dump()}


@app.post("/api/demo-layout", summary="Generate layout with demo floor plan")
async def generate_demo_layout(requirements: ClientRequirements):
    """
    Generate a layout using a built-in demo floor plan (no file upload needed).
    Useful for testing and demonstrations.
    """
    from models.floor_plan import BoundingBox, Point

    # 2000 sqm rectangular office floor plate (50m x 40m)
    demo_fp = FloorPlanData(
        file_name="demo_floor_plan.dxf",
        file_format="dxf",
        bounding_box=BoundingBox(
            min_x=0, min_y=0,
            max_x=50000, max_y=40000,  # millimetres
        ),
        scale_factor=1000.0,
        total_area=2000.0,
        usable_area=1700.0,
        core_area=120.0,
        floor_outline=[
            Point(x=0, y=0), Point(x=50000, y=0),
            Point(x=50000, y=40000), Point(x=0, y=40000),
        ],
        warnings=["Using demo floor plan — upload your DWG/DXF for real analysis."],
    )

    demo_id = "demo"
    _floor_plans[demo_id] = demo_fp

    try:
        layout = await generate_layout(demo_fp, requirements)
    except Exception as e:
        logger.exception("Demo layout generation failed")
        raise HTTPException(500, f"Demo layout generation failed: {e}")

    _layouts[layout.layout_id] = layout
    return {
        "layout_id": layout.layout_id,
        "floor_plan": demo_fp.model_dump(),
        "layout": layout.model_dump(),
    }


@app.get("/api/space-types", summary="Get available space types with metadata")
async def get_space_types():
    """Returns all available space types with labels and default colours."""
    from services.ai_layout_generator import SPACE_COLOURS
    from models.layout import SpaceType

    return [
        {
            "value": st.value,
            "label": st.value.replace("_", " ").title(),
            "color": SPACE_COLOURS.get(st, "#E5E7EB"),
        }
        for st in SpaceType
    ]
