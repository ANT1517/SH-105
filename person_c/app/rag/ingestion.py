import chromadb
from typing import Optional, Any

# Curated knowledge base for Phase 8 using official SEBI material
CURATED_MODULES = [
    {
        "module": "Saving & Goals",
        "topic": "financial_goals",
        "text": "Saving is the process of setting aside a portion of current income for future use. Financial goals give direction to your saving efforts. A financial goal is a target to save a specific amount of money in a specific period of time. Financial goals can be short-term, medium-term, or long-term.",
        "source_name": "SEBI Investor - Financial Goals and Budgeting",
        "source_url": "https://investor.sebi.gov.in/moneymatters-budandfinangoal.html",
        "source_class": "SEBI"
    },
    {
        "module": "Saving & Goals",
        "topic": "smart_goals",
        "text": "Goals should be SMART: Specific, Measurable, Achievable, Realistic, and Time-bound. By being specific about what you want to achieve and when, you can determine exactly how much you need to save each month. Budgeting helps in tracking your income and expenses to ensure you meet these goals.",
        "source_name": "SEBI Investor - Financial Goals and Budgeting",
        "source_url": "https://investor.sebi.gov.in/moneymatters-budandfinangoal.html",
        "source_class": "SEBI"
    },
    {
        "module": "Loans",
        "topic": "before_borrowing",
        "text": "Before taking a loan, always check whether the lender is regulated by an official authority like the RBI. Understand your repayment capacity by analyzing your income and existing expenses. Compare interest rates, processing fees, and late-payment charges across different lenders before deciding.",
        "source_name": "SEBI Investor - Think Before You Borrow Money",
        "source_url": "https://investor.sebi.gov.in/moneymatters-borrowmoney.html",
        "source_class": "SEBI"
    },
    {
        "module": "Loans",
        "topic": "repayment",
        "text": "Understand the interest calculation method and the total repayment period. Ensure you make repayments on time to avoid penalties and protect your credit history. Avoid excessive borrowing, which can lead to a debt trap.",
        "source_name": "SEBI Investor - Think Before You Borrow Money",
        "source_url": "https://investor.sebi.gov.in/moneymatters-borrowmoney.html",
        "source_class": "SEBI"
    },
    {
        "module": "Money Management",
        "topic": "budgeting",
        "text": "Effective money management starts with a budget. A budget tracks your income and expenses, helping you prioritize needs over wants. Keep track of where your money goes so you can identify areas to cut back and increase your savings.",
        "source_name": "SEBI Investor - Personal Finance",
        "source_url": "https://investor.sebi.gov.in/moneymatters.html",
        "source_class": "SEBI"
    },
    {
        "module": "Money Management",
        "topic": "emergency_fund",
        "text": "It is important to save regularly and build an emergency fund. An emergency fund should ideally cover a few months of essential living expenses, protecting you from unexpected financial shocks without needing to borrow at high interest rates.",
        "source_name": "SEBI Investor - Personal Finance",
        "source_url": "https://investor.sebi.gov.in/moneymatters.html",
        "source_class": "SEBI"
    }
]

def setup_chroma_collection(client: chromadb.ClientAPI, collection_name: str = "saathi_education") -> Any:
    # Delete if exists to make it deterministic
    try:
        client.delete_collection(collection_name)
    except Exception:
        pass

    # Use Chroma's default embedding function (ONNX all-MiniLM-L6-v2) for real semantic retrieval
    collection = client.create_collection(
        name=collection_name
    )
    
    # Ingest curated modules
    documents = []
    metadatas = []
    ids = []
    
    for i, item in enumerate(CURATED_MODULES):
        documents.append(item["text"])
        metadatas.append({
            "module": item["module"],
            "topic": item["topic"],
            "source_name": item["source_name"],
            "source_url": item["source_url"],
            "source_class": item["source_class"]
        })
        ids.append(f"doc_{i}")
        
    collection.add(
        documents=documents,
        metadatas=metadatas,
        ids=ids
    )
    
    return collection
