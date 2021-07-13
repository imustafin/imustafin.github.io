---
layout: post
title: "Оптимизация БД Heroku Postgres для бесплатного использования"
date: 2021-07-13
ref: sibrowser
---
Оптимизация схемы реляционной базы данных для соответствия
бесплатному уровню Heroku Postgres на примере приложения SIBrowser.

[SIBrowser][sibrowser] --- это сайт, на котором можно удобно искать
пакеты для [Своей игры (SIGame)][sigame].
В последнее время я работал над этим проектом.
Мы с друзьями часто играем в свою игру, и нам постоянно
надо находить хорошие пакеты для вечера. Чтобы упростить эту задачу,
я решил сделать сайт, который собирает пакеты из интернета и показывает
различную статистику.

Сайт сделан на [Ruby on Rails][ror] и разворачивается на [Heroku][heroku].
Чтобы сэкономить, я использую бесплатный уровень [Heroku Postgres][heroku-postgres],
который даёт 10к строчек и 1ГБ хранилища и бесплатный уровень [Heroku Redis][heroku-redis],
который даёт 25МБ хранилища.

Для фонового сбора пакетов я использую [Sidekiq][sidekiq] с Heroku Redis-ом
как хранилище состояния очереди. Для этой задачи пока вполне хватает
бесплатного уровня Heroku Redis: сейчас используется < 1МБ из 25МБ
бесплатных.

Однако, ограничение бесплатного уровня Heroku Postgres в 10к строк
очень заметно в этом проекте.

## Оптимизация базы данных по стоимости
Чтобы уместить приложение в ограничения бесплатного уровня Heroku Postgres,
можно произвести несколько изменений в архитектуру базы данных.
Взглянем на высокоуровневую ER-модель проекта.

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

Table(Автор)

Table(Тег)

Table(Раунд)

Table(Тема)

Table(Вопрос)

Автор }|--o{ Пакет
Пакет }|--o{ Тег
Пакет ||-r-o{ Раунд
Раунд ||-r-o{ Тема
Тема ||-r-o{ Вопрос
{% endplantuml %}

Эта диаграмма более или менее представляет предметную область приложения.
Автор имеет ноль или больше пакетов. Пакет может иметь ноль или больше тегов
и раундов. Раунд может иметь ноль или больше тем. Тема может иметь ноль или
больше вопросов.

В идеале нам бы хотелось иметь нормализованную базу данных в третьей или
четвёртой нормальной форме. Однако, каждый шаг нормализации будет пораждать
всё больше и больше строк.

В зависимости от того, какие запросы мы хотим поддерживать в нашей БД,
мы можем денормализовать некоторые сущности.

## Шаг 1: главная таблица
Из ER-диаграммы мы видим, что `Пакет` является центральной сущностью.
В самом деле, мы можем попробовать сделать все остальные сущности аттрибутами
сущности `Пакет`.

Мы можем хранить теги и авторов просто как массивы строк. Цепочка
раунды-темы-вопросы, которую мы будем просто называть *структурой*, может
быть представлена как вложенные массивы или хеши.

Для сохранения объектов в базе данных мы можем использовать метод [serialize](serialize)
из Active Recrod. В этом случае типы полей в БД должны быть `text` или `string`.

```ruby
class Package < ApplicationRecord
  serialize :authors, Array
  serialize :structure, Hash
  serialize :tags, Array
end
```

Такой подход позволяет сжать всю ER-модель всего в одну таблицу. Однако,
база данных становится ненормализованной, у нас остаётся только первичный
ключ `id` для пакетов.

Далее мы покажем, что это не страшно и мы можем реализовать несколько
видов запросов. Мы всё ещё можем получить список всех пакетов или информацию
о конкретном пакете по его ключу. Мы даже можем упорядочивать пакеты по авторам,
если массив авторов всегда будет сортироваться перед записью в БД.

## Шаг 2: Поиск по авторам, используя индексы по JSONB
Так как бесплатный уровень Heroku Postgres не ограничивает количество индексов,
мы можем построить инвертированный индекс по столбцы `authors` для эффективного
поиска, но сначала нам нужно изменить тип столбца на JSONB.

После того, как столбцы были превращены в JSONB, нам не нужно явно указывать
AR, что эти поля нужно сериализовывать методом `serialize`. Значения и так
будут автоматически превращаться в и из JSONB.

Мы будем делать регистронезависимый поиск по авторам, потому что 
авторы часто используют заглавные буквы по-разному в разных пакетах.

Сначала нам нужно построить индекс:

```sql
CREATE INDEX authors_icase_index
ON packages
USING gin (LOWER(authors::text)::jsonb);
```

Чтобы этот индекс использовался, запросы должны использовать точно такое же
выражение:

```ruby
class Package < ApplicationRecord
  scope :by_author, ->(author) do
    where('LOWER(authors::text)::jsonb @> to_jsonb(LOWER(?)::text)', author)
  end
end
```

Мы можем проверить, что индекс используется с помощью `EXPLAIN`:
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

Однако, у нас нет численного первичного ключа для автора. Авторы определяются
только по их имени в нижнем регистре. В таком случае, чтобы реализовать страницу автора,
на которой будут отображаться пакеты этого автора, мы можем вставить имя
автора прямо в путь к странице.

```ruby
# routes.rb
resources :authors, only: [:show], constraints: { id: /.+/ }
```

Параметр `constraints` позволит Rails понимать авторов с пробелами и
косыми чертами в имени. Например, в системе есть автор `https://vk.com/sigamepack`,
а страница этого автора доступна по адресу
[http://www.sibrowser.ru/packages/authors/https://vk.com/sigamepack](http://www.sibrowser.ru/packages/authors/https:%2F%2Fvk.com%2Fsigamepack).

## Шаг 3: Полнотекстовый поиск по JSONB столбцам 
Также мы можем производить полнотекстовый поиск по столбцам с типом JSONB.
Есть [хорошая статья Ли Халидея][pganlyze-fulltext], которая описывает реализацию
полнотекстового поиска с использованием гема [pg_search][pg_search] и типа `ts_vector`
в Postgres.

Здесь я покажу как можно использовать такой же подход для поиска по JSONB столбцам.


Генерируемый столбец `searchable` может давать веса значениям типа JSONB. Функция
`to_tsvector` может принимать JSONB объект:

```sql
ALTER TABLE packages
ADD COLUMN searchable tsvector GENERATED ALWAYS AS (
  setweight(to_tsvector('russian', coalesce(name, '')), 'A') ||
  setweight(to_tsvector('russian', coalesce(authors, '{}')), 'B') ||
  setweight(to_tsvector('russian', coalesce(tags, '{}')), 'B') ||
  -- Названия раундов
  setweight(to_tsvector('russian', coalesce(jsonb_path_query_array(structure, '$[*].name'), '{}')), 'B') ||
  -- Названия тем
  setweight(to_tsvector('russian', coalesce(jsonb_path_query_array(structure, '$[*].themes[*].name'), '{}')), 'B')
) STORED;
```

Этот пример показывает как добавить глубоко вложенные значения в индекс, используя
JSON пути.

Настройки `pg_search` остаются такими же:
```ruby
class Package < ApplicationRecord
  include PgSearch::Model
  
  pg_search_scope :search_freetext,
    against: :searchable, # не используется если указан tsvector_column
    using: {
      tsearch: {
        dictionary: 'russian',
        tsvector_column: 'searchable'
      }
    }
```

Вот и всё. Желаю вам счастливого и бюджетного использования Heroku :relaxed:

{% include refs/sibrowser.md %}
