# Saathi Person C

Person C is the financial education, personalization, and safety module for the Saathi project.

## Real Source-Backed RAG Architecture (Phase 8)

Person C uses a Retrieval-Augmented Generation (RAG) architecture powered by Chroma DB to provide grounded financial guidance.

### Official Sources
The knowledge base is exclusively populated from official, authoritative sources:
- **SEBI Investor - Financial Goals and Budgeting** (https://investor.sebi.gov.in/moneymatters-budandfinangoal.html)
- **SEBI Investor - Think Before You Borrow Money** (https://investor.sebi.gov.in/moneymatters-borrowmoney.html)
- **SEBI Investor - Personal Finance** (https://investor.sebi.gov.in/moneymatters.html)

### Modules
The knowledge base is divided into the following core modules:
1. **Saving & Goals**: Covers financial goals, SMART goals, and tracking progress.
2. **Loans**: Covers lender legitimacy, repayment capacity, interest rates, and avoiding debt traps.
3. **Money Management**: Covers budgeting, tracking income/expenses, and emergency funds.

### Ingestion Mechanics
Documents are ingested using `app/rag/ingestion.py`. The ingestion process:
1. Pre-defines the curated chunks derived from the SEBI/RBI sources.
2. Embeds the chunks using Chroma's default `all-MiniLM-L6-v2` ONNX model (local, zero external dependencies).
3. Stores the vectors in the `saathi_education` collection.

### Metadata Schema
Every chunk stored in the vector database contains strict metadata to ensure accurate grounding and attribution:
```json
{
  "module": "Saving & Goals",
  "topic": "smart_goals",
  "source_name": "SEBI Investor - Financial Goals and Budgeting",
  "source_url": "https://investor.sebi.gov.in/moneymatters-budandfinangoal.html",
  "source_class": "SEBI"
}
```

### Retrieval
Retrieval occurs in `app/rag/retrieval.py` using `ChromaRetriever`. 
When a user asks a question, the text is embedded locally using `all-MiniLM-L6-v2` and compared against the vector database using cosine similarity. The top most relevant document is retrieved and injected into the LLM system prompt.

### Rebuilding the Knowledge Base
To rebuild the knowledge base or run tests, the system uses an ephemeral client in development, or a persistent client in production. Simply invoking `setup_chroma_collection()` from `app.rag.ingestion` drops the existing collection (if it exists) and repopulates it with the curated chunks.
