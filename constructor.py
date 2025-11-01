from neo4j import GraphDatabase
import csv
from helper import *
from globalVars import *

# Defined in globalVars.py in my pc because there's password, change the values as needed
URI = URI #"neo4j://localhost:7687"
AUTH = AUTH #("neo4j", "{yourPassword}")
DBNAME = DBNAME #"{yourDBName}"
DATASET = DATASET #"wn.csv"

def main():
    with GraphDatabase.driver(URI, auth=AUTH) as driver:
        try:
            driver.verify_connectivity()
            print("Connection successful!")
        except Exception as e:
            print(f"Connection failed: {e}")
            return

        with driver.session(database=DBNAME) as session:
            print("Processing CSV and creating graph...")
            
            try:
                with open(DATASET, mode='r', newline='', encoding='utf-8') as file:
                    reader = csv.reader(file)
                    
                    try:
                        next(reader) 
                    except StopIteration:
                        print("CSV file is empty.")
                        return
                        
                    count = 0
                    for row in reader:
                        if len(row) > 0: 
                            title = row[2].strip()
                            genreString = row[6].strip()
                            tagString = row[7].strip()
                            authorString = row[14].strip()
                            associatedWorksString = row[9].strip()
                            descriptionString = row[8].strip()
                            languageString = row[13].strip()
                            yearString = row[16].strip() # Example: Is it column 15?


                            statusString = row[17].strip()
                            licensedString = row[18].strip()
                            translatedString = row[19].strip()
                            publisherString = row[20].strip()
                            linkString = row[1].strip()
                            
                            if title:
                                session.execute_write(
                                    createRelationships, 
                                    title, 
                                    authorString, 
                                    genreString, 
                                    tagString,
                                    associatedWorksString,
                                    descriptionString,
                                    languageString,
                                    yearString,
                                    statusString,
                                    licensedString,
                                    translatedString,
                                    publisherString,
                                    linkString
                                )
                                count += 1
                                if count % 100 == 0:
                                    print(f"Processed {count} rows...")
                    print(f"Processing complete. Processed {count} rows.")

            except FileNotFoundError:
                print(f"Error: The file '{DATASET}' was not found.")
            except Exception as e:
                print(f"An error occurred: {e}")
                
if __name__ == "__main__":
    main()