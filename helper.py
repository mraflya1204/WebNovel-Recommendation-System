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
        # Finds 'title': '...' and extracts the content
        titles = re.findall(r"'title':\s*'((?:\\'|[^'])*)'", s)
        
        # Un-escapes \' to '
        return [title.replace("\\'", "'").strip() for title in titles]
    
    except Exception as e:
        print(f"Warning: Could not parse associated works with regex: {s} | Error: {e}")
        return []

def parseStringList(s):
    """
    Parses a string that is supposed to be a list of strings.
    
    This function is designed to handle two types of errors:
    1. Malformed list syntax (e.s., missing a closing ']').
       - Solved by using regex to find all quoted items.
    2. Concatenated strings (e.g., "['BeastkinChildcare...']").
       - Solved by splitting items that match a CamelCase pattern.
    """
    if not s:
        return []
        
    s = s.strip()
    final_items = []
    
    try:
        # Step 1: Use regex to find all single-quoted strings.
        # This is robust to malformed list syntax (like missing ']').
        # It finds 'item1' and 'item2' in "['item1', 'item2'"
        quoted_items = re.findall(r"'((?:\\'|[^'])*)'", s)
        
        if quoted_items:
            cleaned_items = [item.replace("\\'", "'").strip() for item in quoted_items]
            
            # Step 2: Iterate and check for "concatenated string" problem
            for item in cleaned_items:
                if not item:
                    continue
                    
                # Heuristic for concatenated string:
                # 1. No spaces in the item
                # 2. Contains a lowercase letter followed by an uppercase (e.g., "kinChild")
                if ' ' not in item and re.search(r'[a-z][A-Z]', item):
                    # It's a concatenated string. Split it by capital letters.
                    # e.g., "BeastkinChildcare" -> ["Beastkin", "Childcare"]
                    split_items = re.split(r'(?=[A-Z])', item)
                    
                    # Add the *split* items
                    final_items.extend([i.strip() for i in split_items if i.strip()])
                else:
                    # It's a normal item (e.g., "Beastkin" or "Childhood Promise")
                    final_items.append(item)
            return final_items

        # Step 3: Fallback for other formats (e.g., double quotes, or just "[]")
        # Try ast.literal_eval for perfectly-formed lists
        try:
            items = ast.literal_eval(s)
            if isinstance(items, list):
                # It's a valid list, but might still contain a concatenated string
                cleaned_items = [str(item).strip() for item in items]
                
                for item in cleaned_items:
                    if not item:
                        continue
                    # Run the same concatenation check
                    if ' ' not in item and re.search(r'[a-z][A-Z]', item):
                        split_items = re.split(r'(?=[A-Z])', item)
                        final_items.extend([i.strip() for i in split_items if i.strip()])
                    else:
                        final_items.append(item)
                return final_items
        except (ValueError, SyntaxError):
            # ast.literal_eval failed, and our regex found nothing.
            # This handles the case where the *entire* string is just
            # "BeastkinChildcare..." (no quotes, no brackets).
            if ' ' not in s and re.search(r'[a-z][A-Z]', s):
                split_items = re.split(r'(?=[A-Z])', s)
                return [i.strip() for i in split_items if i.strip()]

    except Exception as e:
        print(f"Warning: A parsing error occurred: {e} | String: {s}")

    # If we get here, no method worked
    if s and s != '[]': # Don't warn for known empty lists
        print(f"Warning: Could not parse string list, returning empty: {s}")
    return []

def createRelationships(tx, title, authorString, genreString, tagString, associatedWorksString, descriptionString, languageString, yearString, statusString, licensedString, translatedString, publisherString, linkString):
    # This function uses the parsers from above
    genreList = parseStringList(genreString)
    tagList = parseStringList(tagString)
    authorList = parseStringList(authorString) 
    associatedWorks = parseAssociatedWorks(associatedWorksString) 
    
    query = """
    MERGE (n:Novel {name: $title})
    ON CREATE SET
        n.description = $descriptionString,
        n.language = $languageString,
        n.year = $yearString,
        n.status = $statusString,
        n.licensed = $licensedString,
        n.translated = $translatedString,
        n.publisher = $publisherString,
        n.link = 'https://www.novelupdates.com/series/' + $linkString
    ON MATCH SET
        n.description = $descriptionString,
        n.language = $languageString,
        n.year = $yearString,
        n.status = $statusString,
        n.licensed = $licensedString,
        n.translated = $translatedString,
        n.publisher = $publisherString,
        n.link = 'https://www.novelupdates.com/series/' + $linkString
    
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
           associatedWorks=associatedWorks,
           descriptionString=descriptionString,
           languageString=languageString,
           yearString=yearString,
           statusString=statusString,
           licensedString=licensedString,
           translatedString=translatedString,
           publisherString=publisherString,
           linkString=linkString 
    )