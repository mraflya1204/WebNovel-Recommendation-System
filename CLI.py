import sys
from globalVars import *
from neo4j import GraphDatabase

# Defined in globalVars.py in my pc because there's password, change the values as needed
URI = URI #"neo4j://localhost:7687"
AUTH = AUTH #("neo4j", "{yourPassword}")
DBNAME = DBNAME #"{yourDBName}"
DATASET = DATASET #"wn.csv"

def print_results(records, title):
    """Helper function to print query results."""
    if not records:
        print(f"\nNo results found for '{title}'.")
        return
    
    print(f"\n--- Results for '{title}' ---")
    for i, record in enumerate(records):
        rec_title = record.get('recommendation', record.get('title', 'N/A'))
        print(f"  {i+1}. {rec_title}")
    print("------------------------")

def search_by_title(session):
    """Search for a novel by its title."""
    title = input("Enter a novel title to search for (can be partial): ").strip()
    if not title:
        print("Search cannot be empty.")
        return

    query = """
    MATCH (n:Novel)
    WHERE n.name CONTAINS $title
    RETURN DISTINCT n.name AS title, n.year AS year, n.language AS language
    LIMIT 10
    """
    
    try:
        results = session.execute_read(lambda tx: list(tx.run(query, title=title)))
        if not results:
            print(f"\nNo novel found matching '{title}'.")
            return
            
        print(f"\n--- Found {len(results)} matching novel(s) ---")
        for i, record in enumerate(results):
            print(f"  {i+1}. {record['title']} ({record.get('year', 'N/A')}, {record.get('language', 'N/A')})")
        print("-----------------------------------")
        
    except Exception as e:
        print(f"An error occurred during search: {e}")

def search_by_genre(session):
    """Search for novels that have ALL specified genres."""
    genre_input = input("Enter genres (separated by ';'): ").strip()
    if not genre_input:
        print("Search cannot be empty.")
        return

    genre_list = [g.strip() for g in genre_input.split(';') if g.strip()]
    if not genre_list:
        print("No valid genres entered.")
        return

    query = """
    MATCH (n:Novel)
    WHERE ALL(g_name IN $genre_list WHERE (n)-[:HasGenre]->(:Genre {name: g_name}))
    RETURN n.name AS title, n.year AS year, n.language AS language
    LIMIT 10
    """
    
    try:
        results = session.execute_read(lambda tx: list(tx.run(query, genre_list=genre_list)))
        
        if not results:
            print(f"\nNo novel found matching all genres: {', '.join(genre_list)}.")
            return
        
        print(f"\n--- Found {len(results)} novel(s) matching all genres ---")
        for i, record in enumerate(results):
            print(f"  {i+1}. {record['title']} ({record.get('year', 'N/A')}, {record.get('language', 'N/A')})")
        print("--------------------------------------------------")
        
    except Exception as e:
        print(f"An error occurred during search: {e}")

def search_by_tag(session):
    """Search for novels that have ALL specified tags."""
    tag_input = input("Enter tags (separated by ';'): ").strip()
    if not tag_input:
        print("Search cannot be empty.")
        return

    tag_list = [t.strip() for t in tag_input.split(';') if t.strip()]
    if not tag_list:
        print("No valid tags entered.")
        return

    query = """
    MATCH (n:Novel)
    WHERE ALL(t_name IN $tag_list WHERE (n)-[:HasTag]->(:Tag {name: t_name}))
    RETURN n.name AS title, n.year AS year, n.language AS language
    LIMIT 10
    """
    
    try:
        results = session.execute_read(lambda tx: list(tx.run(query, tag_list=tag_list)))
        
        if not results:
            print(f"\nNo novel found matching all tags: {', '.join(tag_list)}.")
            return
        
        print(f"\n--- Found {len(results)} novel(s) matching all tags ---")
        for i, record in enumerate(results):
            print(f"  {i+1}. {record['title']} ({record.get('year', 'N/A')}, {record.get('language', 'N/A')})")
        print("------------------------------------------------")
        
    except Exception as e:
        print(f"An error occurred during search: {e}")

def find_by_author(session):
    """Find other novels by the same author."""
    title = input("Enter a novel title to find works from the same author: ").strip()
    if not title:
        return
        
    query = """
    MATCH (n1:Novel {name: $title})-[:WrittenBy]->(a:Author)<-[:WrittenBy]-(n2:Novel)
    WHERE n1 <> n2
    RETURN DISTINCT n2.name AS recommendation, a.name AS reason
    LIMIT 10
    """
    
    try:
        records = session.execute_read(lambda tx: list(tx.run(query, title=title)))
        print_results(records, f"Other works from {title}'s author(s)")
    except Exception as e:
        print(f"An error occurred: {e}")
        print("Hint: Make sure the novel title is spelled exactly correct.")

def find_by_association(session):
    """Find directly associated works (sequels, prequels, etc.)."""
    title = input("Enter a novel title to find associated works: ").strip()
    if not title:
        return

    query = """
    MATCH (n1:Novel {name: $title})-[:AssociatedWith]-(n2:Novel)
    WHERE n1 <> n2
    RETURN DISTINCT n2.name AS recommendation, 'Directly Associated' AS reason
    LIMIT 10
    """
    
    try:
        records = session.execute_read(lambda tx: list(tx.run(query, title=title)))
        print_results(records, f"Works associated with {title}")
    except Exception as e:
        print(f"An error occurred: {e}")
        print("Hint: Make sure the novel title is spelled exactly correct.")

def find_by_genre(session):
    """Find novels with at least 2 shared genres."""
    title = input("Enter a novel title to find works with similar genres: ").strip()
    if not title:
        return
        
    query = """
    MATCH (n1:Novel {name: $title})-[:HasGenre]->(g:Genre)<-[:HasGenre]-(n2:Novel)
    WHERE n1 <> n2
    WITH n2, count(g) AS sharedFeatures
    WHERE sharedFeatures >= 2
    RETURN DISTINCT n2.name AS recommendation, 
            'Shared ' + toString(sharedFeatures) + ' genres' AS reason, 
            sharedFeatures
    ORDER BY sharedFeatures DESC
    LIMIT 10
    """
    
    try:
        records = session.execute_read(lambda tx: list(tx.run(query, title=title)))
        print_results(records, f"Works with similar genres to {title} (min. 2)")
    except Exception as e:
        print(f"An error occurred: {e}")
        print("Hint: Make sure the novel title is spelled exactly correct.")

def find_by_tag(session):
    """Find novels with at least 4 shared tags."""
    title = input("Enter a novel title to find works with similar tags: ").strip()
    if not title:
        return
        
    query = """
    MATCH (n1:Novel {name: $title})-[:HasTag]->(t:Tag)<-[:HasTag]-(n2:Novel)
    WHERE n1 <> n2
    WITH n2, count(t) AS sharedFeatures
    WHERE sharedFeatures >= 4
    RETURN DISTINCT n2.name AS recommendation, 
            'Shared ' + toString(sharedFeatures) + ' tags' AS reason, 
            sharedFeatures
    ORDER BY sharedFeatures DESC
    LIMIT 10
    """
    
    try:
        records = session.execute_read(lambda tx: list(tx.run(query, title=title)))
        print_results(records, f"Works with similar tags to {title} (min. 4)")
    except Exception as e:
        print(f"An error occurred: {e}")
        print("Hint: Make sure the novel title is spelled exactly correct.")


def print_menu():
    """Prints the main menu options."""
    print("\n--- Novel Recommendation System ---")
    print("1. Search by Novel Title")
    print("2. Search by Genres (must match all)")
    print("3. Search by Tags (must match all)")
    print("4. Recommend: By same author")
    print("5. Recommend: Associated works (sequels/prequels)")
    print("6. Recommend: By similar genre (shares 2+)")
    print("7. Recommend: By similar tags (shares 4+)")
    print("8. Exit")
    print("-----------------------------------")

def main():
    """Main CLI loop."""
    with GraphDatabase.driver(URI, auth=AUTH) as driver:
        try:
            driver.verify_connectivity()
            print("Successfully connected to Neo4j database!")
        except Exception as e:
            print(f"Failed to connect to Neo4j: {e}")
            return

        with driver.session(database=DBNAME) as session:
            while True:
                print_menu()
                # MODIFIED: Updated range
                choice = input("Enter your choice (1-8): ")
                
                if choice == '1':
                    search_by_title(session)  # Renamed
                elif choice == '2':
                    search_by_genre(session)  # NEW
                elif choice == '3':
                    search_by_tag(session)    # NEW
                elif choice == '4':
                    find_by_author(session)
                elif choice == '5':
                    find_by_association(session)
                elif choice == '6':
                    find_by_genre(session)
                elif choice == '7':
                    find_by_tag(session)
                elif choice == '8': # MODIFIED
                    print("Exiting...")
                    break
                else:
                    # MODIFIED: Updated range
                    print("Invalid choice. Please enter a number from 1 to 8.")

if __name__ == "__main__":
    main()