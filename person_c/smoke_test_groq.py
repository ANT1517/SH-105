import os
import sys
from dotenv import load_dotenv

def main():
    load_dotenv()
    api_key = os.environ.get("GROQ_API_KEY")
    if not api_key:
        print("Skipping smoke test: GROQ_API_KEY is not configured in the environment.")
        sys.exit(0)
        
    print("Initializing GroqLLM...")
    try:
        from app.education.llm import GroqLLM
    except ImportError as e:
        print(f"Failed to import GroqLLM: {e}")
        sys.exit(1)
        
    llm = GroqLLM(api_key=api_key)
    
    question = "Explain saving money in two simple sentences for a beginner."
    print(f"Sending question: '{question}'")
    
    # We pass an empty context list because we just want to verify the API connection
    # in generate_response. However, generate_response checks if contexts is empty and returns a fallback.
    # So we'll pass a dummy context.
    from app.rag.models import RetrievedContext
    contexts = [RetrievedContext(text="Saving money is good.", metadata={}, score=1.0)]
    
    try:
        response = llm.generate_response(question, contexts)
        if not response:
            print("FAILED: Model returned an empty string.")
            sys.exit(1)
        print("\n--- Groq Response ---")
        print(response)
        print("---------------------")
        print("SUCCESS: Smoke test passed.")
    except Exception as e:
        print(f"FAILED: An exception occurred during generation: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
