from typing import List, Union
from chromadb import EmbeddingFunction, Documents, Embeddings

class MockEmbeddingFunction(EmbeddingFunction):
    def __init__(self):
        pass
        
    def __call__(self, input: Documents) -> Embeddings:
        embeddings = []
        for text in input:
            # Handle if text is somehow a list
            if isinstance(text, list):
                text = text[0]
            lower_text = text.lower()
            # Simple keyword matching to create orthogonal vectors for tests
            if "money map" in lower_text:
                embeddings.append([1.0, 0.0, 0.0])
            elif "saving" in lower_text or "goal" in lower_text:
                embeddings.append([0.0, 1.0, 0.0])
            elif "loan" in lower_text or "borrow" in lower_text:
                embeddings.append([0.0, 0.0, 1.0])
            else:
                # Unrelated
                embeddings.append([0.1, 0.1, 0.1])
        return embeddings
        
    def embed_query(self, input: Union[str, List[str]]) -> List[Union[float, List[float]]]:
        if isinstance(input, str):
            return self.__call__([input])[0]
        return self.__call__(input)
        
    def embed_documents(self, input: List[str]) -> List[List[float]]:
        return self.__call__(input)
