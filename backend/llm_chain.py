import os
from dotenv import load_dotenv
from langchain_neo4j import Neo4jGraph
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_neo4j import GraphCypherQAChain
import logging
from langchain_core.prompts import PromptTemplate
from .cypher_template import CYPHER_GENERATION_TEMPLATE

try:
    from globalVars import URI, AUTH, DBNAME
except ImportError:
    raise

print("--- [DEBUG] Memulai llm_chain.py ---")
print(f"[DEBUG] Target URI: {URI}")
print(f"[DEBUG] Target User: {AUTH[0]}")
print(f"[DEBUG] Target Database (DBNAME): {DBNAME}")
print("---------------------------------------")

load_dotenv()

if not os.getenv("GOOGLE_API_KEY"):
    raise EnvironmentError("GOOGLE_API_KEY not found in .env file. Please add it from makersuite.google.com")

llm = ChatGoogleGenerativeAI(
    model="gemini-2.5-flash",
    temperature=0,
    convert_system_message_to_human=True 
)

# 2. Inisialisasi Koneksi Graph
graph = Neo4jGraph(
    url=URI, 
    username=AUTH[0], 
    password=AUTH[1], 
    database=DBNAME
)
print("Neo4jGraph instance connected.")

# 3. (Sangat Penting) Refresh Schema
print("Refreshing Neo4j graph schema...")
graph.refresh_schema()
print(f"Schema refreshed. Nodes: {list(graph.structured_schema.get('node_labels', []))}")

cypher_prompt = PromptTemplate(
    template=CYPHER_GENERATION_TEMPLATE, 
    input_variables=["schema", "question"]
)

# 4. Buat Chain Utama
cypher_chain = GraphCypherQAChain.from_llm(
    llm=llm,
    graph=graph,
    verbose=True, 
    return_intermediate_steps=True, # agar kita bisa mengambil data mentah
    allow_dangerous_requests=True, # fitur keamanan dari langchain yang perlu diaktifkan untuk query bebas
    cypher_prompt=cypher_prompt 
)

# 5. Buat Fungsi Wrapper
def get_llm_response(question: str):
    """
    Mengambil pertanyaan bahasa natural, mengubahnya menjadi Cypher,
    menjalankannya di Neo4j, dan mengembalikan data mentahnya.
    """
    response = {}
    try:
        response = cypher_chain.invoke({"query": question})

        if 'result' in response and 'intermediate_steps' in response:
            intermediate_steps = response.get('intermediate_steps', [])
            
            # DEBUG: Print struktur lengkap
            print(f"[DEBUG] Type of intermediate_steps: {type(intermediate_steps)}")
            print(f"[DEBUG] Length: {len(intermediate_steps)}")
            if intermediate_steps:
                print(f"[DEBUG] First item type: {type(intermediate_steps[0])}")
                print(f"[DEBUG] First item keys: {intermediate_steps[0].keys() if isinstance(intermediate_steps[0], dict) else 'Not a dict'}")
                print(f"[DEBUG] Full structure: {intermediate_steps}")
            
            # Ambil raw_data
            raw_data = []
            intermediate_steps = response.get('intermediate_steps', [])
            
            # intermediate_steps adalah list dengan 2 item:
            # [0] = {'query': '...'}
            # [1] = {'context': [...]} 
            if len(intermediate_steps) >= 2:
                context_dict = intermediate_steps[1]
                if isinstance(context_dict, dict) and 'context' in context_dict:
                    raw_data = context_dict['context']
                
            print(f"[LLM Chain] Final raw_data: {raw_data}") 
            
            return {
                "answer": response.get('result', 'Query executed, but no answer provided.'),
                "raw_data": raw_data
            }
        else:
            return {"error": True, "answer": "LLM chain returned an invalid response structure."}

    except Exception as e:
        print(f"[LLM Chain] CRITICAL ERROR: {e}")
        return {"error": True, "answer": f"Error in LangChain query: {e}"}

# (Opsional) Uji file ini secara langsung
#if __name__ == "__main__":
    print("Testing llm_chain.py with Gemini...")
    test_question = "Give me 10 novel recommendations according the same genre like novel Godsend"
    data = get_llm_response(test_question)
    print("--- Test Result ---")
    print(data)