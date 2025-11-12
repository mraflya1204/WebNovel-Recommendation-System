from flask import Flask, jsonify, request
from flask_cors import CORS
from neo4j import GraphDatabase
import atexit 

try:
    from globalVars import URI, AUTH, DBNAME
except ImportError:
    print("Error: Could not import globalVars.py.")
    print("Ensure you are running from the root folder: python -m backend.api")
    exit()

try:
    from .llm_chain import get_llm_response
    print("Successfully imported LLM logic from llm_chain.py")
except ImportError as e:
    print(f"CRITICAL: Failed to import 'llm_chain.py'. Error: {e}")
    print("LLM Chat (AI) tab will not work.")
    get_llm_response = None

# 2. Set up the Flask application
app = Flask(__name__)
CORS(app) 

# 3. Create a single Neo4j Driver instance for the entire application
try:
    print("Creating Neo4j Driver connection...")
    driver = GraphDatabase.driver(URI, auth=AUTH)
    driver.verify_connectivity()
    print("Neo4j Driver connection successful.")
except Exception as e:
    print(f"Failed to create Neo4j Driver connection: {e}")
    exit()

# 4. Function to close the driver connection when Flask shuts down
@atexit.register
def close_driver():
    if driver:
        print("\nClosing Neo4j Driver connection.")
        driver.close()

# --- Internal Helper Function ---
def _run_query(query, parameters={}):
    """Internal helper to run a read-only query."""
    with driver.session(database=DBNAME) as session:
        # 1. Jalankan kueri dan dapatkan daftar 'Record'
        result_records = session.execute_read(lambda tx: list(tx.run(query, parameters)))

        # 2. bah setiap 'Record' menjadi 'dict' standar Python
        results_as_dicts = [dict(record) for record in result_records]

        return results_as_dicts

# --- API Endpoint Definitions ---

@app.route("/")
def home():
    """Simple API welcome page."""
    return "Welcome to the WebNovel Recommendation API!"

@app.route("/api/search/title/<string:title_search>")
def api_search_by_title(title_search):
    """API for searching novels by title (partial match)."""
    query = """
    MATCH (n:Novel)
    WHERE n.name CONTAINS $title
    RETURN DISTINCT n.name AS title, n.year AS year, n.language AS language
    LIMIT 10
    """
    try:
        results = _run_query(query, {"title": title_search})
        if not results:
            print(f"\nNo novel found matching '{title_search}'.")
            return jsonify([])  # Return empty list if no results
        return jsonify(results)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/api/search/genre/<string:genre_input>")
def api_search_by_genre(genre_input):
    """API for searching novels by genre (separated by ';')."""
    genre_list = [g.strip() for g in genre_input.split(';') if g.strip()]
    if not genre_list:
        return jsonify({"error": "Genre list cannot be empty"}), 400
        
    query = """
    MATCH (n:Novel)
    WHERE ALL(g_name IN $genre_list WHERE (n)-[:HasGenre]->(:Genre {name: g_name}))
    RETURN n.name AS title, n.year AS year, n.language AS language
    LIMIT 10
    """
    try:
        results = _run_query(query, {"genre_list": genre_list})
        return jsonify(results)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# Endpoint 3: Recommendation by Author
@app.route("/api/recommend/author/<string:title>")
def api_find_by_author(title):
    """API: Get recommendations based on novel title -> same author."""
    query = """
    MATCH (n1:Novel {name: $title})-[:WrittenBy]->(a:Author)<-[:WrittenBy]-(n2:Novel)
    WHERE n1 <> n2
    RETURN DISTINCT n2.name AS title, n2.year AS year, n2.language AS language
    LIMIT 10
    """
    try:
        results = _run_query(query, {"title": title})
        return jsonify(results)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# Endpoint 4: Recommendation by Similar Genre
@app.route("/api/recommend/genre/<string:title>")
def api_find_by_genre(title):
    """API: Get recommendations based on novel title -> similar genres (min 2)."""
    query = """
    MATCH (n1:Novel {{name: $title}})-[:HasGenre]->(g:Genre)<-[:HasGenre]-(n2:Novel)
    WHERE n1 <> n2
    WITH n2, count(g) AS sharedFeatures
    WHERE sharedFeatures >= 2
    RETURN DISTINCT n2.name AS title, n2.year AS year, n2.language AS language
    LIMIT 10
    """
    try:
        results = _run_query(query, {"title": title})
        return jsonify(results)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/stats/top-genres")
def api_stats_top_genres():
    """API: Get top 10 genres by novel count."""
    query = """
    MATCH (n:Novel)-[:HasGenre]->(g:Genre)
    RETURN g.name AS name, count(n) AS novelCount
    ORDER BY novelCount DESC
    LIMIT 10
    """
    try:
        results = _run_query(query)
        return jsonify(results)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/api/stats/top-tags")
def api_stats_top_tags():
    """API: Get top 20 tags by novel count."""
    query = """
    MATCH (n:Novel)-[:HasTag]->(t:Tag)
    RETURN t.name AS name, count(n) AS novelCount
    ORDER BY novelCount DESC
    LIMIT 20
    """
    try:
        results = _run_query(query)
        return jsonify(results)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/api/stats/novels-per-year")
def api_stats_novels_per_year():
    """API: Get novel count per year."""
    query = """
    MATCH (n:Novel)
    WHERE n.year IS NOT NULL AND n.year <> ""
    RETURN n.year AS year, count(n) AS novelCount
    ORDER BY year ASC
    """
    try:
        results = _run_query(query)
        
        # Convert year to integer for proper sorting in JS/Charts
        valid_results = []
        for item in results:
            try:
                item['year'] = int(item['year'])
                valid_results.append(item)
            except (ValueError, TypeError):
                pass # Skip items with invalid year format

        return jsonify(valid_results)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/api/llm-query", methods=["POST"])
def api_llm_query():
    
    # 1. Pastikan modul LLM berhasil diimpor
    if get_llm_response is None:
        return jsonify({"error": "LLM (AI) functionality is not configured on this server."}), 503 

    # 2. Ambil pertanyaan dari frontend
    try:
        data = request.get_json()
        question = data['question']
        if not question:
            return jsonify({"error": "Question cannot be empty."}), 400
    except Exception:
        return jsonify({"error": "Invalid JSON body. 'question' key is missing."}), 400

    print(f"[LLM Gateway] Menerima pertanyaan: {question}")

    # 3. Panggil Logika LLM
    try:
        # 'llm_result' adalah dict: {'answer': '...', 'raw_data': [...], 'error': '...'}
        llm_result = get_llm_response(question)

        if llm_result.get('error'):
            return jsonify({
                "error": True,
                "answer": llm_result.get('answer', 'An unknown error occurred in the AI chain.')
            }), 400 

        # 'raw_data' adalah list: [{'title': '...', 'year': '...'}, ...]
        clean_data = llm_result.get('raw_data', [])
        
        print(f"[LLM Gateway] Mengirim {len(clean_data)} hasil ke frontend.")

        return jsonify(clean_data) 

    except Exception as e:
        print(f"[LLM Gateway] CRITICAL ERROR: {e}")
        return jsonify({"error": f"An internal server error occurred: {e}"}), 500


# --- Run the Server ---
if __name__ == "__main__":
    print("Starting Flask API server at http://127.0.0.1:5001")
    app.run(host="0.0.0.0", port=5001, debug=True)