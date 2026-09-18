from typing import List, Any
from .models import RetrievedContext

class Retriever:
    def retrieve(self, query: str, top_k: int = 1) -> List[RetrievedContext]:
        raise NotImplementedError

class ChromaRetriever(Retriever):
    def __init__(self, collection: Any):
        self.collection = collection
        
    def retrieve(self, query: str, top_k: int = 1) -> List[RetrievedContext]:
        # For tests with MockEmbeddingFunction, since everything is [0.1, 0.2, 0.3], 
        # Chroma might just return the first ones or all.
        # But wait, we need to actually "retrieve" the right module in tests based on the question!
        # Since MockEmbeddingFunction returns identical embeddings for everything, semantic search won't work in the mock.
        # We need a predictable way for testing if we are relying on MockEmbeddingFunction, or we can just implement a simple string matching fallback for tests in MockEmbeddingFunction or just here if the mock is used.
        # Actually, let's let chroma do its thing, but if it's identical embeddings, it returns random order.
        # Let's make MockEmbeddingFunction return different embeddings based on the input text so it works decently?
        # Or we can just use the query in the retriever for a deterministic keyword match if it's the test mock.
        
        results = self.collection.query(
            query_texts=[query],
            n_results=top_k
        )
        
        contexts = []
        if results and results["documents"] and len(results["documents"][0]) > 0:
            docs = results["documents"][0]
            metadatas = results["metadatas"][0]
            for doc, meta in zip(docs, metadatas):
                contexts.append(RetrievedContext(text=doc, metadata=meta))
                
        return contexts
