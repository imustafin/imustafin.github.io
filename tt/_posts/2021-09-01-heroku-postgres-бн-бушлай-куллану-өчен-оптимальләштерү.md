---
layout: post
title: "Heroku Postgres БН бушлай куллану өчен оптимальләштерү"
date: 2021-09-01
ref: sibrowser
---
Реляцион бирелмәләр нигезне (БН) Heroku Postgres бушлай дәрәҗәдә
куллану өчен SIBrowser кушымтасы мисалында оптимальләштерү.

[SIBrowser][sibrowser] --- [Своя игра (SIGame)][sigame] пакетлар эзләү сайты.
Соңгы вакытта мин бу сайтны ясый идем.
Без дуслар белән еш уйныйбыз һәм безгә һәрвакыт яхшы пактларны эзләргә кирәк.
Эзләүне гадиләштерү өчен мин интернеттан пакет җыю һәм пакет статистика
күрсәтү системаны төзи башладым.

Сайт [Ruby on Rails][ror] нигезендә төзелгән һәм [Heroku][heroku]
платформасында җәелә. Акча саклану өчен Heroku-ның бушлай БН дәрәҗәләрне
кулланам. [Heroku Postgres][heroku-postgres] бушлай дәрәҗәдә 
1ГБ саклагыч урыны һәм 10к БН рәт бирелә. [Heroku Redis][heroku-redis] бушлай
дәрәҗәдә 25МБ хәтер бирелә.

Фонда пакет җыю өчкн мин [Sidekiq][sidekiq]-ны кулланам. Sidekiq бирем чиратны
Heroku Redis-та саклый. Моның өчен Heroku Redis-ның бушлай дәрәҗәсе җитә:
хәзер 25МБ-тан < 1МБ кулланыла.

Ләкин, Heroku Postgres-ның рәт чикләмәләре бу проектта зур йогынты ясый.

## Бирелмәләр нигезне акча саклау өчен оптимальләштерү
Heroku Postgres бушлай дәрәҗәдә куллану өчен, без БН архитектурада берничә
үзгәреш ясый алабыз. Проектның ER-модельгә карыйк:

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

Table(Пакет) 

Table(Ясаучы)

Table(Тәг)

Table(Раунд)

Table(Тема)

Table(Сорау)

Ясаучы }|--o{ Пакет
Пакет }|--o{ Тәг
Пакет ||-r-o{ Раунд
Раунд ||-r-o{ Тема
Тема ||-r-o{ Сорау
{% endplantuml %}

Ясаучының ноль я күбрәк пакет бар. Пакетның ноль я күбрәк тәг һәм раунд бар.
Раундның ноль я күбрәк тема бар. Теманың ноль я күбрәк сорау бар.

Өченче я дүртенче нормаль формага нормальләшкән БН белән эшләргә яхшы булыр иде.
Ләкин, һәр нормальләштерү адымы рәт саны күбәйәчәк.

Системада кирәкле БН таләпләргә карап, без кайбер объектларны
денормальләштерергә
алабыз.

## Адым 1: төп таблица
ER-диаграммага караганда, `Пакет` төп объект булуны күрәбез.
Чыннан да, башка объектларны `Пакет`-ның атрибутлары кебек сакла алабыз.

Тәгләр һәм ясаучылар юл массивы формасында сакла алабыз. Раунд-тема-сорау
чылбырны *структура* дип атыйк һәм кертелгән массивлар я һәшләр формасында
сакла алабыз да.

Шундый объект саклау өчен, Active Record-ның [serialize](serialize) ысулы
белән саклаячакбыз. Моның өчен БН кырлары `text` яисә `string` типлы булырга
тиеш.

```ruby
class Package < ApplicationRecord
  serialize :authors, Array
  serialize :structure, Hash
  serialize :tags, Array
end
```

Шулай итеп, барлык ER-модельне бер генә таблицада сакланыла, әмма БН
нормаль формасыны югалта. Пакетлар гына үзе санлы беренчел ачкычы бар.

Соңрак без моның бик начар булмавыны күрсәтәчәкбез. БН-дән без берничә
таләп ясый алабыз әле: барлык пакет исемлекне укый алабыз, кирәкле
пакетның мәгълүматны ачкыч белән укый алабыз да.

## Адым 2: JSONB индекс белән ясаучы буенча эзләү
Heroku Postgres бушлай дәрәҗәдә индекс саны чикләнмәгән һәм без берничә
индекс ясачакбыз. Ясаучы буенча эзләү тизләтү өчен, `author` атрибуты нигезендә
инвертләнгән индекс төзи алабыз, әмма баштан безгә бу атрибутның тибы JSONB-га
өйләнергә кирәк.

JSONB өйләнүдән соң, `serialize` ысулы безгә кирәкми чөнки кыйммәтләр автоматик
рәвештә JSONB-дан һәм JSONB-га өйләнәчәкләр.

Без хәреф регистр бәйләнмәгән эзләүне ясаячакбыз, чөнки ясаучы исемнәре
төрле пакетларда төрлечә язылалар.

Баштан индексны төзибез:

```sql
CREATE INDEX authors_icase_index
ON packages
USING gin (LOWER(authors::text)::jsonb);
```

Эзләүдә индекс кулланыр өчен, нәкъ шундый таләпне кулланырга кирәк:

```ruby
class Package < ApplicationRecord
  scope :by_author, ->(author) do
    where('LOWER(authors::text)::jsonb @> to_jsonb(LOWER(?)::text)', author)
  end
end
```

Индекс кулланувын `EXPLAIN`-да күрәбез:
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

Ләкин, ясаучының санлы беренчел ачкычы юк. Ясаучыларны аларның аскы регистрлы
исемләре нигезендә аңлыйбыз. Бу очракта, ясаучының исеме адрес эчендә булырга
тиеш:

```ruby
# routes.rb
resources :authors, only: [:show], constraints: { id: /.+/ }
```

Шундый `constraints` көйләве Rails-ка буш аралы һәм авыш сызыклы исемнәрне
аңларга әйтә. Мәсәлән, системада `https://vk.com/sigamepack` исемле
ясаучы бар һәм аның бите 
[https://www.sibrowser.ru/authors/https://vk.com/sigamepack](https://www.sibrowser.ru/authors/https:%2F%2Fvk.com%2Fsigamepack)
адреста урнашкан.

## Адым 3: JSONB атрибут бунча тулы текст эзләү
JSONB атрбутларда тулы текст эзләүне ясый алабыз да.

[Ли Һаллидейнның мәкәләсе][pganalyze-fulltext] тулы текст эзләүне
[pg_search][pg_search] гемы һәм `ts_vector` тибы нигезендә төзүне тасвирлый.

Монда мин JSONB атрибут өчендә эзләү өчен охшаш ысулы күрсәтәм.

Исәпләнүче `searchable` баганасы JSONB элементларга үзе дәрәҗәләрне бирә ала.
`to_tsvector` функциясе икенче аргумент урында JSONB типны да аңлый.

```sql
ALTER TABLE packages
ADD COLUMN searchable tsvector GENERATED ALWAYS AS (
  setweight(to_tsvector('russian', coalesce(name, '')), 'A') ||
  setweight(to_tsvector('russian', coalesce(authors, '{}')), 'B') ||
  setweight(to_tsvector('russian', coalesce(tags, '{}')), 'B') ||
  -- Раунд исемләре
  setweight(to_tsvector('russian', coalesce(jsonb_path_query_array(structure, '$[*].name'), '{}')), 'B') ||
  -- Тема исемләре
  setweight(to_tsvector('russian', coalesce(jsonb_path_query_array(structure, '$[*].themes[*].name'), '{}')), 'B')
) STORED;
```

Бу үрнәктә JSONB-да ерак кертелгән кыйммәтне, JSON юллары кулланып, индекска кую
күрсәтелгән.

`pg_search` көйләве шундый ук кала:
```ruby
class Package < ApplicationRecord
  include PgSearch::Model
  
  pg_search_scope :search_freetext,
    against: :searchable, # tsvector_column булганда куллынмый
    using: {
      tsearch: {
        dictionary: 'russian',
        tsvector_column: 'searchable'
      }
    }
end
```

## Йомгаклау
Бу мәкаләдә без берничә мәсьәлә карап чыктык:
* Heroku Postgres бушлай дәрәҗәнең чикләмәләр һәм алар белән эшләү
* JSONB белән БН денормальләштерү
* JSONB өчен инвертләштереләгән индекс төзү
* JSONB объектларга кертелгән юлларда тулы текст эзләү

{% include refs/sibrowser.md %}
