# Web Novel Recommendation System using Neo4j Graph Database
Final Project for EF234505 - Knowledge Based Systems Engineering (I) 

|    NRP     |      Name      |
| :--------: | :------------: |
| 5025231085 | Muhammad Rafly Abdillah |
| 5025231069 | R. Rafif Aqil Aabid Hermawan |
| 5025231075 | Reino Yuris Kusumanegara |
| 5025231161 | Muhammad Rizqy Hidayat |
| 5025231011 | Fazle Robby Pratama |

## Instruction
Requirement:
- Neo4j
- Python
- Neo4j Python Package (use `pip install neo4j`)

Steps:
- Create a Neo4j database within your local instance
- Run the instance
- Edit `globalVars.py` with the corresponding information:
  - URI can be found in local instances tab, is usually `URI = "neo4j://127.0.0.1:7687"`
  - AUTH is the credentials that you use when you create the instance, example: `AUTH = ("neo4j", "password")`
  - DBNAME is the database name that you want to use within the local instance, example: `DBNAME = "FINAL PROJECT"`
  - DATASET is the dataset used, we use `DATASET = "wn.csv"`
- Run `constructor.py` to initialize the database. It will take a while as there is ~11k rows of Novel information
- After finishing, you can see your instance for the result
- Use `CLI.py` for playground
