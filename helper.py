import ast
import re

# Associated Works need its own function because the data has complex format
def parseAssociatedWorks(s):
    """
    Parses the complex 'related_series' string using regex
    to extract all novel titles.
    """
    if not s:
        return []
    try:
        titles = re.findall(r"'title':\s*'((?:\\'|[^'])*)'", s)
        
        return [title.strip() for title in titles]
    
    except Exception as e:
        print(f"Warning: Could not parse associated works with regex: {s} | Error: {e}")
        return []

def parseStringList(s):
    if not s:
        return []
        
    try:
        items = ast.literal_eval(s)
        
        if not isinstance(items, list):
            return []
        
        return [str(item).strip() for item in items]
        
    except (ValueError, SyntaxError):
        print(f"Warning: Could not parse string list: {s}")
        return []

def createRelationships(tx, title, authorString, genreString, tagString, associatedWorksString):
    genreList = parseStringList(genreString)
    tagList = parseStringList(tagString)
    authorList = parseStringList(authorString) 
    associatedWorks = parseAssociatedWorks(associatedWorksString) 
    
    query = """
    MERGE (n:Novel {name: $title})
    
    FOREACH (authorName IN $authorList |
        MERGE (a:Author {name: authorName})
        MERGE (n)-[:WrittenBy]->(a)
    )

    FOREACH (genreName IN $genreList |
        MERGE (g:Genre {name: genreName})
        MERGE (n)-[:HasGenre]->(g)
    )
    
    FOREACH (tagName IN $tagList |
        MERGE (t:Tag {name: tagName})
        MERGE (n)-[:HasTag]->(t)
    )

    FOREACH (workTitle IN $associatedWorks |
        MERGE (aw:Novel {name: workTitle})
        MERGE (n)-[:AssociatedWith]->(aw)
    )
    
    RETURN n.name
    """

    tx.run(query, 
           title=title, 
           authorList=authorList,  
           genreList=genreList, 
           tagList=tagList,
           associatedWorks=associatedWorks
    )