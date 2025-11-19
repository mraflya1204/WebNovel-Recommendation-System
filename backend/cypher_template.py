CYPHER_GENERATION_TEMPLATE = """
Anda adalah ahli Neo4j Cypher. Tugas Anda adalah menerjemahkan pertanyaan pengguna menjadi satu kueri Cypher.
Gunakan HANYA node, relationship, dan properti yang ada di dalam schema.

Schema Database:
{schema}

---
ATURAN PENTING UNTUK REKOMENDASI:
Ini adalah aturan KETAT. Selalu gunakan pola kueri ini saat diminta.

1.  Jika pengguna meminta rekomendasi "by genre" atau "similar genre":
    -   Gunakan pola "Shared Features" (seperti di gambar Anda).
    -   Hitung jumlah genre yang sama (`count(g)`).
    -   HANYA kembalikan novel dengan minimal 2 genre yang sama (`sharedFeatures >= 2`).
    -   Contoh: "recommend novels like Godsend by genre" ->
        ```cypher
        MATCH (n1:Novel {{name: $title}})-[:HasGenre]->(g:Genre)<-[:HasGenre]-(n2:Novel)
        WHERE n1 <> n2
        WITH n2, count(g) AS sharedFeatures
        WHERE sharedFeatures >= 2
        ORDER BY sharedFeatures DESC
        RETURN DISTINCT n2.name AS title, n2.year AS year, n2.language AS language
                        'Shared ' + toString(sharedFeatures) + ' genres' AS reason
        LIMIT 10
        ```

2.  Jika pengguna meminta rekomendasi "by tag" atau "similar tag":
    -   Gunakan pola "Shared Features".
    -   Hitung jumlah tag yang sama (`count(t)`).
    -   HANYA kembalikan novel dengan minimal 2 tag yang sama (`sharedFeatures >= 2`).
    -   Contoh: "recommend novels like Godsend by tag" ->
        ```cypher
        MATCH (n1:Novel {{name: $title}})-[:HasTag]->(t:Tag)<-[:HasTag]-(n2:Novel)
        WHERE n1 <> n2
        WITH n2, count(t) AS sharedFeatures
        WHERE sharedFeatures >= 2
        ORDER BY sharedFeatures DESC
        RETURN DISTINCT n2.name AS title, n2.year AS year, n2.language AS language
                        'Shared ' + toString(sharedFeatures) + ' tags' AS reason
        LIMIT 10
        ```

3.  Jika pengguna meminta "by author" atau "same author":
    -   Gunakan kueri `MATCH` sederhana pada relationship `:WrittenBy`.
    -   Contoh: "novels by author of Godsend" ->
        ```cypher
        MATCH (n1:Novel {{name: $title}})-[:WrittenBy]->(a:Author)<-[:WrittenBy]-(n2:Novel)
        WHERE n1 <> n2
        RETURN DISTINCT n2.name AS title, n2.year AS year, n2.language AS language
                        'Same author: ' + a.name AS reason
        LIMIT 10
        ```

4.  Jika pengguna meminta rekomendasi "by Associated works":
    -   Gunakan kueri `MATCH` sederhana pada relationship `:AssociatedWith`.
    -   Contoh: "novels associated with Godsend" ->
        ```cypher
        MATCH (n1:Novel {{name: $title}})-[:AssociatedWith]-(n2:Novel)
        WHERE n1 <> n2
        RETURN DISTINCT n2.name AS name, n2.year AS year, n2.language AS language
                        'Associated work' AS reason
        LIMIT 10
        ```

5.  Untuk pertanyaan 'COUNT' atau 'LIST' sederhana:
    -   Gunakan kueri `MATCH` sederhana.
    -   Contoh: "how many novels are there?" -> `MATCH (n:Novel) RETURN count(n) AS count`
    -   Contoh: "what genres is Godsend?" -> `MATCH (n:Novel {{name: "Godsend"}})-[:HasGenre]->(g:Genre) RETURN g.name AS genre`

6.  Jika pengguna ingin *mendaftar* (list) semua novel dari penulis tertentu (BUKAN rekomendasi):
    -   Gunakan kueri `MATCH` sederhana untuk menemukan semua karya penulis.
    -   Contoh: "list all novels by 'Author Name'" ->
        ```cypher
        MATCH (a:Author {{name: $authorName}})<-[:WrittenBy]-(n:Novel)
        RETURN n.name AS title, n.year AS year, n.language AS language
                a.name AS authorName
        LIMIT 20
        ```

7.  Jika pengguna ingin *menyaring* (filter) novel berdasarkan properti spesifik (seperti `status`, `year`, `language`):
    -   Gunakan klausa `WHERE` pada properti node `Novel`.
    -   (BARU) Selalu lakukan `OPTIONAL MATCH` untuk mendapatkan penulis agar UI bisa menampilkan info lengkap.
    -   Contoh 1: "list all completed novels" ->
        ```cypher
        MATCH (n:Novel)
        WHERE n.status = 'Completed'
        OPTIONAL MATCH (a:Author)<-[:WrittenBy]-(n)
        RETURN n.name AS title, n.year AS year, n.language AS language,
               a.name AS authorName  
        LIMIT 20
        ```
    -   Contoh 2: "find novels from 2020" ->
        ```cypher
        MATCH (n:Novel)
        WHERE n.year = '2020'
        OPTIONAL MATCH (a:Author)<-[:WrittenBy]-(n)  
        RETURN n.name AS title, n.language AS language, n.year AS year,
               a.name AS authorName  
        LIMIT 20
        ```
    -   Contoh 3: "show me japanese novels" ->
        ```cypher
        MATCH (n:Novel)
        WHERE n.language = 'Japanese'
        OPTIONAL MATCH (a:Author)<-[:WrittenBy]-(n)  
        RETURN n.name AS title, n.year AS year, n.language AS language,
               a.name AS authorName  
        LIMIT 20
        ```
8.  Jika pengguna meminta rekomendasi "hybrid", "paling mirip", atau "gabungan" (berdasarkan genre DAN tag):
    -   Gunakan kueri "Hybrid Score" yang lebih sederhana.
    -   Hitung **2 poin** untuk setiap genre yang sama.
    -   Hitung **1 poin** untuk setiap tag yang sama.
    -   HANYA kembalikan novel dengan `totalScore >= 5`.
    -   Contoh: "recommend novels most similar to 'Godsend'" ->
```cypher
        MATCH (n1:Novel {{name: $title}})
        
        // Hitung skor genre (2 poin per genre)
        OPTIONAL MATCH (n1)-[:HasGenre]->(g:Genre)<-[:HasGenre]-(n2:Novel)
        WHERE n1 <> n2
        WITH n1, n2, count(DISTINCT g) * 2 AS genreScore
        
        // Hitung skor tag (1 poin per tag)
        OPTIONAL MATCH (n1)-[:HasTag]->(t:Tag)<-[:HasTag]-(n2)
        WHERE n1 <> n2
        WITH n2, genreScore, count(DISTINCT t) * 1 AS tagScore
        
        // Gabungkan skor
        WITH n2, (genreScore + tagScore) AS totalScore
        WHERE totalScore >= 5
        
        // Hitung similarity score (skala 0-10)
        // Asumsi max: 10 genre (20 poin) + 10 tag (10 poin) = 30 total
        WITH n2, totalScore,
             round(toFloat(totalScore) / 30.0 * 10.0 * 10) / 10.0 AS similarityScore
        
        RETURN n2.name AS title, n2.year AS year, n2.language AS language,
               'Similarity: ' + toString(similarityScore) + '/10' AS reason,
               similarityScore AS reasonScore
        ORDER BY similarityScore DESC
        LIMIT 10
    ```

---

Pertanyaan Pengguna (selalu jawab dalam Cypher):
{question}
"""
