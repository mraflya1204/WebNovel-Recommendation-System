<div align="center">
# Web Novel Recommendation System using Neo4j Graph Database

<em>Final Project for EF234505 - Knowledge Based Systems Engineering (I)</em>

<!-- BADGES -->
<img src="https://img.shields.io/github/last-commit/reinoyk/Pico-Park-Clone?style=flat&logo=git&logoColor=white&color=0080ff" alt="last-commit">
<img src="https://img.shields.io/github/languages/top/reinoyk/Pico-Park-Clone?style=flat&color=0080ff" alt="repo-top-language">
<img src="https://img.shields.io/github/languages/count/reinoyk/Pico-Park-Clone?style=flat&color=0080ff" alt="repo-language-count">

<em>Built with the tools and technologies:</em>

<img src="https://img.shields.io/badge/Markdown-000000.svg?style=flat&logo=Markdown&logoColor=white" alt="Markdown">
<img src="https://img.shields.io/badge/JavaScript-F7DF1E.svg?style=flat&logo=JavaScript&logoColor=black" alt="JavaScript">
<img src="https://img.shields.io/badge/Python-3776AB.svg?style=flat&logo=Python&logoColor=white" alt="Python">

|    NRP     |      Name      |
| :--------: | :------------: |
| 5025231085 | Muhammad Rafly Abdillah |
| 5025231069 | R. Rafif Aqil Aabid Hermawan |
| 5025231075 | Reino Yuris Kusumanegara |
| 5025231161 | Muhammad Rizqy Hidayat |
| 5025231011 | Fazle Robby Pratama |

</div>
<br>

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

## Samples
![RelatedWorks](https://github.com/user-attachments/assets/1e889b6c-6574-4c67-8ce5-b77da7c27c30)

![RecommendedTags](https://github.com/user-attachments/assets/bc53fad8-deee-4faf-8e9b-7bd57b798a37)
