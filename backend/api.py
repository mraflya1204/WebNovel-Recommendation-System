from flask import Flask, jsonify, request
from flask_cors import CORS
from neo4j import GraphDatabase
import atexit # To close the connection when the server stops

# 1. Import your global variables (from the root folder)
try:
    from globalVars import URI, AUTH, DBNAME
except ImportError:
    print("Error: Could not import globalVars.py.")
    print("Ensure you are running from the root folder: python -m backend.api")
    exit()

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
    """API for searching novels by title (case-insensitive partial match)."""
    
    query = """
    MATCH (n:Novel) 
    WHERE toLower(n.name) CONTAINS toLower($title)
    RETURN DISTINCT n.name AS title, n.year AS year, n.language AS language
    LIMIT 10
    """
    try:
        results = _run_query(query, {"title": title_search})
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
    
@app.route("/api/search/tag/<string:tag_input>")
def api_search_by_tag(tag_input):
    """API for searching novels by tag (separated by ';')."""
    tag_list = [t.strip() for t in tag_input.split(';') if t.strip()]
    if not tag_list:
        return jsonify({"error": "Tag list cannot be empty"}), 400
        
    query = """
    MATCH (n:Novel)
    WHERE ALL(t_name IN $tag_list WHERE (n)-[:HasTag]->(:Tag {name: t_name}))
    RETURN n.name AS title, n.year AS year, n.language AS language
    LIMIT 10
    """
    try:
        results = _run_query(query, {"tag_list": tag_list})
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
    """API: Get recommendations based on novel title -> similar genres (min 4)."""
    query = """
    MATCH (n1:Novel {name: $title})-[:HasGenre]->(g:Genre)<-[:HasGenre]-(n2:Novel)
    WHERE n1 <> n2
    WITH n2, count(g) AS sharedFeatures
    WHERE sharedFeatures >= 4
    RETURN DISTINCT n2.name AS title, n2.year AS year, n2.language AS language
    LIMIT 10
    """
    try:
        results = _run_query(query, {"title": title})
        return jsonify(results)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# Endpoint 5: Recommendation by Similar Tags
@app.route("/api/recommend/tag/<string:title>")
def api_find_by_tags(title):
    """API: Get recommendations based on novel title -> similar tags (min 10)."""
    query = """
    MATCH (n1:Novel {name: $title})-[:HasTag]->(t:Tag)<-[:HasTag]-(n2:Novel)
    WHERE n1 <> n2
    WITH n2, count(t) AS sharedFeatures
    WHERE sharedFeatures >= 10
    RETURN DISTINCT n2.name AS title, n2.year AS year, n2.language AS language
    LIMIT 10
    """
    try:
        results = _run_query(query, {"title": title})
        return jsonify(results)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# Endpoint 6: Recommendation by Associated Works
@app.route("/api/recommend/associated/<string:title>")
def api_find_by_association(title):
    """API: Get recommendations based on novel with associated works."""
    query = """
    MATCH (n1:Novel {name: $title})-[:AssociatedWith]-(n2:Novel)
    WHERE n1 <> n2
    RETURN DISTINCT n2.name AS name, n2.year AS year, n2.language AS language
    LIMIT 10
    """

    try:
        results = _run_query(query, {"title": title})
        return jsonify(results)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# --- Run the Server ---
if __name__ == "__main__":
    print("Starting Flask API server at http://127.0.0.1:5001")
    app.run(host="0.0.0.0", port=5001, debug=True)