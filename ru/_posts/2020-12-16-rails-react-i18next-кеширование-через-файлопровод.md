---
layout: post
title: "React-i18next в Rails: кеширование через файлопровод"
date: 2021-01-25
ref: rails-react-asset-pipeline-caching
redirect_from:
  - /ru/rails-react-i18next-кеширование-через-файлопровод.html
---
Как использовать файлопровод (Asset Pipeline) в Ruby on Rails для эффективного
кеширования файлов перевода.

Здесь мы рассмотрим простейший способ интернационализации `react-rails` приложения,
потом мы обсудим проблемы с кешированием этого подхода, и, наконец,
мы подключим файлопровод (Asset Pipeline) решения этих проблем.

## Использование react-i18next
В этой секции мы добавим `react-i18next` в приложение и сделаем файлы переводов
доступными из папки `public`.

Сначала добавим необходимые зависимости
```shell
yarn add i18next i18next-http-backend react-i18next
```

Инициализируем `i18next` в необходимых точках входа (например, `app/javascript/packs/application.js`):
```js
import i18n from 'i18next';
import I18nextHttpBackend from 'i18next-http-backend';
import { initReactI18next } from 'react-i18next';

i18n
  .use(I18nextHttpBackend)
  .use(initReactI18next)
  .init();
```

[Плагин `i18next-http-backend`][i18next-http-backend] отвечает за скачивание
необходимых файлов перевода для выбранного языка, а `react-i18next` даёт доступ к
`i18next` из самого React приложения.

Сейчас мы можем реализовать интернационализированную версию страницы «Здравствуй, мир!»
с возможностью переключения языка:
```jsx
import React, { Suspense } from 'react';
import { useTranslation } from 'react-i18next';

const TranslatedHelloWorld = () => {
  const { t, i18n } = useTranslation();
  
  return (
    <>
      <h1>{t('helloWorld')}</h1>

      <button onClick={() => i18n.changeLanguage('ru')}>
        Русский
      </button>

      <button onClick={() => i18n.changeLanguage('tt')}>
        Татарча
      </button>
    </>
  );
};

const HelloWorld = () => (
  <Suspense loading='...'>
    <TranslatedHelloWorld />
  </Suspense>
);

export default HelloWorld;
```

Если вы посмотрите на получившуюся страничку, то вы увидите строку «helloWorld»
потому, что мы ещё не предоставили сами переводы для ключа `helloWorld`, а
`i18next` в таких случаях по умолчанию отображает сам ключ вместо перевода.

По умолчанию `i18next-http-backend` ожидает, что файлы переводов доступны
по адресу {% raw %}`/locales/{{lng}}/{{ns}}.json`{% endraw %}
(см. [опцию `loadPath`][i18next-http-backend-options]), где {% raw %}`{{lng}}`{% endraw %}
— это код языка, а {% raw %}`{{ns}}`{% endraw %} — это пространство имён. Стандартное
пространство имён называется `translation`
(см. [опцию `defaultNS`][i18next-options-languages-namespaces-resources]).

Так, в нашем примере сервер должен обрабатывать два пути: `/locales/ru/translation.json`
для русской версии и `/locales/tt/translation.json` для татарской. Мы можем
создать JSON файлы переводов в папке `public` и они будут доступны по этим путям.

Файлы переводов для русского языка будут находится в файле `public/locales/ru/translation.json`:
```json
{
  "helloWorld": "Здравствуй, мир!"
}
```

Файлы переводов для татарского языка будут находиться в файле `public/locales/tt/translation.json`:
```json
{
  "helloWorld": "Сәлам, дөнья!"
}
```

После создания этих файлов можно перезагрузить страницу и убедиться, что
переключение языков работает. Но у такого подхода есть одна проблема, подробнее
о ней в следующей секции.

## Проблемы, связанные с кешированием
Вы можете заметить, что после развёртывания новой версии приложения на сервере,
в браузере выполняется свежая версия JavaScript кода, но иногда
всё ещё используются старые версии файлов перевода, из-за чего
отображаются ключи вместо самих переводов.

Это может случаться потому, что старые версии файлов переводов могут
быть закешированы в браузере.

Как вариант, можно полностью отключить кеширование этих файлов через
настройки на сервере, или через опцию `requestOptions` в `i18next-http-backend`,
или даже через дописывание текущего времени к URL-у для загрузки файлов
как в [этом ответе на StackOverflow][stackoverflow-cb]
(адаптировано для `i18next-http-backend`):
{% raw %}
```js
{
  loadPath: '/locales/{{lng}}/{{ns}}.json?cb=' + new Date().getTime(),
}
```
{% endraw %}

Однако, отключать кеш — не оптимально потому, что с каждой перезагрузкой страницы,
файлы переводов будут скачаны снова.

Лучшим подходом будет правильная настройка кеширования для этих файлов.
Это можно сделать несколькими способами, здесь мы рассмотрим способ,
который обычно используется в Rails, а именно — файлопровод.

## Использование файлопровода для кеширования файлов перевода i18next
В этой секции мы обсудим использование файлопровода Ruby on Rails для
[оборачивания][mdn-ru-revved-resources] имён файлов ([filename revving][sauders-rev]).

Файлопровод [добавляет][asset-pipeline-fingerprinting] хеш содержимого файла
к его имени, поэтому клиенты могут закешировать файл с таким именем навсегда,
а если появится новая версия этого файла, то у него уже будет другое имя и
клиенты смогут скачать новую версию по новому имени файла.

Сейчас мы рассмотрим как пустить файлы переводов по файлопроводу, а затем
настроим `i18next-http-backend` чтобы он брал файлы из файлопровода.

### Перемещение файлов переводов в файлопровод
Чтобы файлы переводов оказались в файлопроводе, нам нужно всего лишь
переместить их из директории `public` в директорию `app/assets`. В нашем случае
у нас получится два файла:
* `app/assets/locales/ru/translation.json`
* `app/assets/locales/tt/translation.json`

Проверьте, что файлопровод увидел файлы переводов, используя консоль (`bundle exec rails c`):
```console?lang=ruby
> ActionController::Base.helpers.asset_path('ru/translation.json')
"/assets/ru/translation-1516916289b1be2609ec39a8f887f301260d6a7db6e5b39aa7da3b0f0ff2dd14.json" 
```

Если вместо этого вы получаете ошибку `Sprockets::Rails::Helper::AssetNotPrecompiled`:
```console?lang=ruby
> ActionController::Base.helpers.asset_path('ru/translation.json')
Traceback (most recent call last):
        1: from (irb):1
Sprockets::Rails::Helper::AssetNotPrecompiled (ru/translation.json)
```

То, возможно, вы используете Sprockets 4. В таком случае вам нужно
обновить файл манифеста ассетов.

#### Обновление файлов манифеста для Sprockets 4
В зависимости от версии гема `sprockets` вам может быть нужно или не нужно
обновлять файл манифеста ассетов. Вы можете проверить версию командой:
```shell
bundle info sprockets
```

Если у вас в проекте Sprockets версии 4, то вам нужно включить директорию
с локалям в файле `app/assets/config/manifest.js`:
```js
//= link_tree ../locales
```

Это требование было [добавлено в Sprockets 4][sprockets-4-migration-guide]
(перевод и акцентирование — от меня):
> Если вы используете sprockets старее, чем 4.0, то Rails будет компилировать
> `application.css`, `application.js`, и **любые** файлы в ваших директориях
> ассетов, которые не распознаны как JS или CSS, но у которых есть расширение
> в имени файла.
>
> ...
>
> Если вы используете Sprockets 4, то Rails будет использовать другую логику для
> определения входных точек компиляции: будет использоваться **только** файл
> `./app/assets/config/manifest.js` для определения начальных файлов.

### Получение путей файлов после файлопровода из JavaScript
После перемещения файлов переводов в файлопровод, их больше нельзя получить
просто по их именам (`/locales/ru/translation.json`). Теперь в их именах
должны присутствовать хеши (`/assets/ru/translations-151...d14.json`).

Эти новые имена можно получить в Ruby из помощника `asset_path`, но их
нельзя получить напрямую в JavaScript. Вместо этого, мы можем использовать
Erb шаблоны чтобы подставилять значения, вычисленные в Ruby, в JavaScript код.

Добавьте поддержку Erb в `webpacker` по [оффициальным инструкциям][webpacker-erb].

Опция `loadPath` библиотеки `i18next-http-backend` может принимать и функцию
`(languages, namespaces) => loadPath`. Хоть аргументы `languages` и `namespaces`
должны быть массивами, они [будут содержать по одному элементу][i18next-http-backend-lngs-nss]
если опция `allowMultiLoading` выставлена в значение `false` (по умолчанию это так).

Напишем нашу функцию `loadPath` в файле `app/javascript/loadPath.js.erb`:
```erb?parent=js
const loadPath = (languages, namespaces) => {
  if (languages[0] === 'ru') {
    return '<%= ActionController::Base.helpers.asset_path("ru/translation.json") %>';
  }
  
  if (languages[0] === 'tt') {
    return '<%= ActionController::Base.helpers.asset_path("tt/translation.json") %>';
  }
  
  return undefined;
};

export default loadPath;
```

И передадим её в `i18next` в файле `app/javascript/packs/application.js`:
```js
import loadPath from 'loadPath.js.erb';

i18n
  .use(I18nextHttpBackend)
  .use(initReactI18next)
  .init({
    backend: {
      loadPath,
    },
  });
```

Сейчас вы можете обновить страницу и увидеть, что кнопки снова работают.

Вот и всё. Желаю вам счастливой интернационализации!

{% include refs/rails-react-asset-pipeline-caching.md %}
