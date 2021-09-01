---
layout: post
title: "Optimizing Heroku Postgres for the Free Tier"
date: 2021-07-12
last_modified_at: 2021-09-01
ref: sibrowser
---
How to optimize a relational database schema to fit
Heroku Postgres free tier limitations with a real-world
example of SIBrowser.

[SIBrowser][sibrowser] is a website for browsing [SIGame][sigame]
packages. It is a project I've been working on recently.
Me and my friends play SIGame from time
to time and we frequently need to find good packages to play. To simplify this
task for us I've made a website which collects packages from the internet
and displays different statistic for them.

The website is built using [Ruby on Rails][ror] and deployed on [Heroku][heroku].
To optimize the costs, I am using [Heroku Postgres][heroku-postgres]
which gives 10k rows and 1GB storage for free and [Heroku Redis][heroku-redis]
which gives 25MB storage for free.

I am using [Sidekiq][sidekiq] for scraping and parsing packages in background
with Heroku Redis as the queue storage. Heroku Redis's free tier
is enough for the current workload with < 1MB used out of 25MB
provided in the free tier.

However, Heroku Postgres's free tier limit of 10k rows is very noticeable
in this project.

## Optimizing the database for cost
Trying to fit the application into Heroku Postgres's free tier requires some
considerations to the database architecture. Let's look at a very high level
ER model for the project.

{% plantuml %}
!define Table(name) class name as "name"
!define primary_key(x) <b>x</b>
!define unique(x) <color:green>x</color>
!define not_null(x) <u>x</u>
hide methods
hide stereotypes
hide circle
hide empty members
skinparam linetype ortho

Table(Package) 

Table(Author)

Table(Tag)

Table(Round)

Table(Theme)

Table(Question)

Author }|--o{ Package
Package }|--o{ Tag
Package ||-r-o{ Round
Round ||-r-o{ Theme
Theme ||-r-o{ Question
{% endplantuml %}

This diagram more or less represents the business domain of the application.
Author can have zero or more packages. Package can have zero or more tags
and rounds. Rounds can have zero or more themes. Themes can have zero
or more questions.

Ideally, we might want to have our database normalized to the third or fourth
normal form. However, each normalization step will generate more and more
rows.

Depending on the specific queries which we want to support, we can denormalize
some entities.

## Step 1: the Main Table
Examining the ER diagram we see that `Package` seems to be the central entity.
In fact, we can try to make all of the other entites to be attributes of `Package`.

We can store tags and authors of a package simply as string arrays. The
round-theme-question, called collectively as `structure`,
can be also modeled using nested arrays or
hashes.

Storing objects in a database can be done using ActiveRecord's [serialize][serialize] method.
The underlying fields in the table should be `text` or `string` type.

```ruby
class Package < ApplicationRecord
  serialize :authors, Array
  serialize :structure, Hash
  serialize :tags, Array
end
```

This approach allows us to compress the whole ER model to just one table. However,
the database is now in an unnormalized form but at least we have the primary key `id`
for packages.

In fact, this structure allows us to do several types of queries. We can show
a list of packages, retrieve information about a specific package by id. We can
even sort packages by authors using indices, given we always sort `authors`
before writing to the database.

## Step 2: Searching by Authors using JSONB indices
Since Heroku Postgres's free tier doesn't have a limit on the amount of indices,
we can make an inverted index on the `authors` column for efficient searching,
but first we need to convert these columns to JSONB.

After the columns are converted to JSONB, we don't need to explicitly tell AR
to `serialize` the fields. They will be automatically converted to and from JSONB
on access.

We will use case insensitive search for searching packages by authors
because often author names are using inconsistent capitalization in packages.

First, we need to create the index:
```sql
CREATE INDEX authors_icase_index
ON packages
USING gin (LOWER(authors::text)::jsonb);
```

In order to utilize this index, the query should use the same expression exactly:
```ruby
class Package < ApplicationRecord
  scope :by_author, ->(author) do
    where('LOWER(authors::text)::jsonb @> to_jsonb(LOWER(?)::text)', author)
  end
end
```

You can check that the index is used using `EXPLAIN`:
```sql
EXPLAIN SELECT "packages".* FROM "packages"
WHERE (LOWER(authors::text)::jsonb @> to_jsonb(LOWER('Timur')::text));

                                    QUERY PLAN                                    
----------------------------------------------------------------------------------
 Bitmap Heap Scan on packages  (cost=8.08..36.14 rows=9 width=677)
   Recheck Cond: ((lower((authors)::text))::jsonb @> to_jsonb('timur'::text))
   ->  Bitmap Index Scan on authors_icase_index  (cost=0.00..8.07 rows=9 width=0)
         Index Cond: ((lower((authors)::text))::jsonb @> to_jsonb('timur'::text))
```

However, we do not have a numeric id for the author. Authors are identified only
by their lowercase names. In this case, to implement the author page with a list
of packages authored by the specific author, we can put the author's name
directly in the path.

```ruby
# routes.rb
resources :authors, only: [:show], constraints: { id: /.+/ }
```

The `constraints` parameter will allow Rails to understand author names with
spaces and slashes in the name. For example, there is an author named `https://vk.com/sigamepack`
and the respective author page is
[https://www.sibrowser.ru/authors/https://vk.com/sigamepack](https://www.sibrowser.ru/authors/https:%2F%2Fvk.com%2Fsigamepack).

## Step 3: Full Text Search on JSONB columns
Additionally, we can do a full text search on JSONB columns. There is [a good article
by Leigh Halliday][pganalyze-fulltext] which describes implementing
a full text search using the [pg_search][pg_search] gem using Postgres `ts_vector`
type.

Here I will show how to use the same approach for searching in JSONB columns.

The generated `searchable` column can give weights to JSONB values. The `to_tsvector`
function can receive a JSONB object:
```sql
ALTER TABLE packages
ADD COLUMN searchable tsvector GENERATED ALWAYS AS (
  setweight(to_tsvector('russian', coalesce(name, '')), 'A') ||
  setweight(to_tsvector('russian', coalesce(authors, '{}')), 'B') ||
  setweight(to_tsvector('russian', coalesce(tags, '{}')), 'B') ||
  -- Round names
  setweight(to_tsvector('russian', coalesce(jsonb_path_query_array(structure, '$[*].name'), '{}')), 'B') ||
  -- Theme names
  setweight(to_tsvector('russian', coalesce(jsonb_path_query_array(structure, '$[*].themes[*].name'), '{}')), 'B')
) STORED;
```

This example shows how to add deeply nested values to the index
by using JSON paths.

And the `pg_search` config stays the same:
```ruby
class Package < ApplicationRecord
  include PgSearch::Model
  
  pg_search_scope :search_freetext,
    against: :searchable, # not used if tsvector_column is specified
    using: {
      tsearch: {
        dictionary: 'russian',
        tsvector_column: 'searchable'
      }
    }
end
```

## Conclusion
In this article we discussed such topics as:
* Heroku Postgres free tier limitations and how to overcome them
* Denormalizing a DB using JSONB
* Building an inverted index based on JSONB values
* Implementing full-text search for strings stored in JSONB objects

{% include refs/sibrowser.md %}
