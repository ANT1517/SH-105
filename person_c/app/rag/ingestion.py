import chromadb
from typing import Optional, Any
from .embeddings import MockEmbeddingFunction

# Curated knowledge base for Phase 2
CURATED_MODULES = [
    {
        "module": "Money Map",
        "text": "A Money Map shows all your financial resources in one place, including cash in hand, bank accounts, SHG savings, chit funds, and post office savings. It helps you see your total wealth and make better decisions.",
        "source_name": "NCFE Basics",
        "source_class": "RBI/SEBI/NCFE"
    },
    {
        "module": "Saving & Goals",
        "text": "Saving is putting aside a portion of your income for future use. Setting specific goals, like education or buying equipment, helps you calculate how much you need to save daily or weekly. Avoid keeping all savings in cash to protect against inflation.",
        "source_name": "Financial Planning Guide",
        "source_class": "research"
    },
    {
        "module": "Loans",
        "text": "A loan is borrowed money that must be repaid with interest. Compare interest rates before taking a loan. SHG loans usually have lower rates than informal moneylenders. Only borrow what you can afford to repay from your business profit or regular income.",
        "source_name": "Rural Credit Handbook",
        "source_class": "provider"
    }
]

def setup_chroma_collection(client: chromadb.ClientAPI, collection_name: str = "saathi_education") -> Any:
    # Delete if exists to make it deterministic
    try:
        client.delete_collection(collection_name)
    except Exception:
        pass

    embedding_function = MockEmbeddingFunction()
    
    collection = client.create_collection(
        name=collection_name, 
        embedding_function=embedding_function
    )
    
    # Ingest curated modules
    documents = []
    metadatas = []
    ids = []
    
    for i, item in enumerate(CURATED_MODULES):
        documents.append(item["text"])
        metadatas.append({
            "module": item["module"],
            "source_name": item["source_name"],
            "source_class": item["source_class"]
        })
        ids.append(f"doc_{i}")
        
    collection.add(
        documents=documents,
        metadatas=metadatas,
        ids=ids
    )
    
    return collection
