from fastapi import FastAPI, HTTPException, Depends
import os
from dotenv import load_dotenv

load_dotenv()
from ..contracts.input import FinancialState, GuidanceRequest
from ..contracts.output import PersonCResponse
import chromadb

from ..rag.ingestion import setup_chroma_collection
from ..rag.retrieval import ChromaRetriever
from ..education.llm import MockLLM
from ..education.service import EducationService

app = FastAPI(title="Saathi - Person C Service")

from ..personalization.service import PersonalizationService
from ..contracts.quiz import QuizRequest, QuizResponse
from ..literacy.quiz import calculate_tier
from ..contracts.simulator import SimulatorInput
from ..simulator.service import SimulatorService
from ..contracts.safety import SafetyRequest
from ..safety.service import SafetyService
from ..integration.person_a import PersonAIntegrationRequest
from ..integration.person_b import PersonBClient, UnknownUserError
from ..contracts.input import GuidanceRequest
from ..contracts.simulator import SimulatorInput

# Initialize Chroma and service (in production this would be more robust)
_chroma_client = chromadb.EphemeralClient()
_collection = setup_chroma_collection(_chroma_client)
_retriever = ChromaRetriever(_collection)

import sys
is_testing = any('pytest' in arg for arg in sys.argv)
groq_api_key = os.environ.get("GROQ_API_KEY")

if groq_api_key and not is_testing:
    from ..education.llm import GroqLLM
    groq_model = os.environ.get("GROQ_MODEL", "openai/gpt-oss-20b")
    _llm = GroqLLM(api_key=groq_api_key, model=groq_model)
else:
    from ..education.llm import MockLLM
    _llm = MockLLM()
    
_education_service = EducationService(_retriever, _llm)
_personalization_service = PersonalizationService(_retriever, _llm)
_simulator_service = SimulatorService(_retriever, _llm)
_safety_service = SafetyService(_llm)
_person_b_client = PersonBClient()

def get_education_service() -> EducationService:
    return _education_service

def get_personalization_service() -> PersonalizationService:
    return _personalization_service

def get_simulator_service() -> SimulatorService:
    return _simulator_service

def get_safety_service() -> SafetyService:
    return _safety_service

def get_person_b_client() -> PersonBClient:
    return _person_b_client

# OCR Service
if is_testing:
    from ..ocr.engine import MockOCREngine
    _ocr_engine = MockOCREngine()
else:
    from ..ocr.engine import PaddleOCREngine
    _ocr_engine = PaddleOCREngine()

from ..ocr.parser import OCRParser
from ..ocr.service import OCRService
_ocr_parser = OCRParser()
_ocr_service = OCRService(_ocr_engine, _ocr_parser)

def get_ocr_service() -> OCRService:
    return _ocr_service

@app.post("/api/v1/integration/person_a/guidance", response_model=PersonCResponse)
async def person_a_integration(
    request: PersonAIntegrationRequest,
    person_b_client: PersonBClient = Depends(get_person_b_client),
    education_service: EducationService = Depends(get_education_service),
    personalization_service: PersonalizationService = Depends(get_personalization_service),
    simulator_service: SimulatorService = Depends(get_simulator_service)
):
    """
    Real Integration API that coordinates fetching B's financial state and routing to the right internal C service.
    """
    if request.request_mode == "education":
        # Education mode does not require financial state
        return education_service.get_guidance(request.question or "")
        
    # For personalized and simulator modes, we need the financial state from Person B
    try:
        financial_state = await person_b_client.get_financial_state(request.user_id)
    except UnknownUserError:
        # Not an outage: retrying won't help, so don't tell the user to "try again later".
        return PersonCResponse(
            response_text="We couldn't find a Saathi account for you yet, so we can't give personalised guidance. Please check with support or record a first transaction to get started.",
            source_class="system",
            mode=request.request_mode,
            disclaimer=True
        )

    if not financial_state:
        # Graceful failure if Person B is down or fails
        return PersonCResponse(
            response_text="We are currently unable to access your financial information. Please try again later.",
            source_class="system",
            mode=request.request_mode,
            disclaimer=True
        )

    if request.request_mode == "personalized":
        guidance_req = GuidanceRequest(
            cash=financial_state.cash,
            bank=financial_state.bank,
            shg=financial_state.shg,
            chit_committed=financial_state.chit_committed,
            post_office=financial_state.post_office,
            business=financial_state.business,
            goal=financial_state.goal,
            question=request.question,
            request_mode="personalized",
            literacy_tier=request.literacy_tier
        )
        return personalization_service.get_guidance(guidance_req)
        
    elif request.request_mode == "simulator":
        # Ensure we have goal data for the simulator from Person B
        if not financial_state.goal:
            return PersonCResponse(
                response_text="Goal information is missing from your financial state.",
                source_class="system",
                mode="simulator",
                disclaimer=True
            )
            
        sim_input = SimulatorInput(
            scenario=request.simulator_scenario or "savings_goal_feasibility",
            target=financial_state.goal.target,
            saved=financial_state.goal.saved,
            monthly_contribution=None, # In real use, maybe pass from request
            timeframe_months=None,
            literacy_tier=request.literacy_tier,
            question=request.question
        )
        return simulator_service.get_simulation(sim_input)

@app.post("/api/v1/safety/check", response_model=PersonCResponse)
async def check_safety(
    request: SafetyRequest,
    safety_service: SafetyService = Depends(get_safety_service)
):
    return safety_service.check_message(request)

@app.post("/api/v1/simulator", response_model=PersonCResponse)
async def get_simulation(
    request: SimulatorInput,
    simulator_service: SimulatorService = Depends(get_simulator_service)
):
    return simulator_service.get_simulation(request)

@app.post("/api/v1/literacy_quiz", response_model=QuizResponse)
async def submit_quiz(request: QuizRequest):
    tier = calculate_tier(request.answers)
    return QuizResponse(tier=tier)

@app.post("/api/v1/guidance", response_model=PersonCResponse)
async def get_guidance(
    request: GuidanceRequest, 
    education_service: EducationService = Depends(get_education_service),
    personalization_service: PersonalizationService = Depends(get_personalization_service)
):
    if request.request_mode == "education":
        if not request.question:
            raise HTTPException(status_code=400, detail="Question is required for education mode")
        return education_service.get_guidance(request.question)
        
    elif request.request_mode == "personalized":
        if not request.question:
            raise HTTPException(status_code=400, detail="Question is required for personalized mode")
        return personalization_service.get_guidance(request)

    # Phase 1 stable logic fallback
    if not request.business or not request.goal:
        raise HTTPException(status_code=400, detail="Invalid financial state: missing business or goal data.")
    
    return PersonCResponse(
        response_text="Based on your goal to save for Education, consider comparing the interest rates.",
        source_class="research",
        mode="personalized",
        disclaimer=True
    )

@app.get("/health")
async def health_check():
    return {"status": "ok"}

from fastapi import UploadFile, File
@app.post("/api/v1/ocr/receipt")
async def process_receipt(file: UploadFile = File(...), ocr_service: OCRService = Depends(get_ocr_service)):
    if file.content_type not in ["image/jpeg", "image/png"]:
        raise HTTPException(status_code=400, detail="Only JPEG and PNG formats are supported.")
    image_bytes = await file.read()
    return ocr_service.process_receipt(image_bytes)
