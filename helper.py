def parseStringList(s):
    if not s or not s.startswith('[') or not s.endswith(']'):
        return []
    
    sStripped = s.strip("[]")
    parts = sStripped.split("'")
    
    items = [part.strip() for part in parts if part.strip()]
    return items

def createRelationships(tx, title, author, genreString, tagString):
    genreList = parseStringList(genreString)
    tagList = parseStringList(tagString)
    
    query = """
    MERGE (n:Novel {name: $title})
    
    FOREACH (authorName IN CASE WHEN $author IS NOT NULL AND $author <> "" THEN [$author] ELSE [] END |
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
    
    RETURN n.name
    """

    tx.run(query, 
           title=title, 
           author=author, 
           genreList=genreList, 
           tagList=tagList
    )
