---
layout: post
title: "React-i18next Rails-та: файлүткәргеч аша кәшләү"
date: 2021-01-25
last_modified_at: 2021-02-15
ref: rails-react-asset-pipeline-caching
redirect_from:
  - /tt/rails-react-i18next-файлүткәргеч-аша-кәшләү.html
---

Тәрҗемә файлларны эффектив рәвештә Ruby on Rails файлүткәргеч белән кәшләү.

Монда без `react-rails` кушымтаны иң җиңел интернациональләштерү ысулыны
карап чыгарарбыз, аннары без бу ысулын кәш белән бәйләнгән проблемнарны
күрербез, һәм ахырда без бу проблемнарны файлүткәргеч (Asset Pipeline) белән
чишәрбез.

## React-i18next-ны куллану
Бу бүлектә без кушымтабызга `react-i18next`-ны өстибез һәм тәрҗемә файлларны
`public` директорийдан укуга мөмкин ясыйбыз.

Баштан без кирәкле пакетларны өстибез.
```shell
yarn add i18next i18next-http-backend react-i18next
```

`i18next`-ны кирәкле керү нокталарда (мәсәлән, `app/javascript/packs/application.js`)
инициализациялибез:
```js
import i18n from 'i18next';
import I18nextHttpBackend from 'i18next-http-backend';
import { initReactI18next } from 'react-i18next';

i18n
  .use(I18nextHttpBackend)
  .use(initReactI18next)
  .init();
```

[`i18next-http-backend` плагины][i18next-http-backend] сайланган телнең
тәрҗемә файлларны йөкли, ә `react-i18next` React кушымтаны `i18next` белән
бәйләнә.

Хәзер без «Сәлам, дөнья!» битне тел сайлау төймәләр белән ясый алабыз.
```jsx
import React, { Suspense } from 'react';
import { useTranslation } from 'react-i18next';

const TranslatedHelloWorld = () => {
  const { t, i18n } = useTranslation();
  
  return (
    <>
      <h1>{t('helloWorld')}</h1>

      <button onClick={() => i18n.changeLanguage('tt')}>
        Татарча
      </button>

      <button onClick={() => i18n.changeLanguage('ru')}>
        Русский
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

Хәзер бу биткә карасагыз сез «helloWorld» юлны гына күрә аласыз чөнки без `helloWorld`
ачкыч өчен бернинди тәрҗемәне бирмәдек әле һәм шундый вакыйгаларда `i18next`
тәрҗемәнең урында ачкычны күрсәтә.

Килешенгәнчә `i18next-http-backend` тәрҗемә файлларны
{% raw %}`/locales/{{lng}}/{{ns}}.json`{% endraw %} адрестан ала
([`loadPath` көйләүне][i18next-http-backend-options] кара). Адреста
{% raw %}`{{lng}}`{% endraw %} — тел коды, ә {% raw %}`{{ns}}`{% endraw %} —
исемнәр киңлеге. Килешенгән исемнәр киңлеге `translation` дип аталган
([`defaultNS` көйләүне][i18next-options-languages-namespaces-resources] кара).

Шулай, сервер бу ике юлны тәэмин итергә тиеш: берсе — `/locales/tt/translation.json`
татарча тәрҗемә бирергә тиеш, икенчесе — `/locales/ru/translation.json`
русча тәрҗемә бирергә тиеш. Бу JSON тәрҗемә файлларны `public` директорийга
куйсабыз, Rails шундый кирәкле юлларны тәэмин ителер.

Татарча тәрҗемәне `public/locales/tt/translation.json` файлга язабыз:
```json
{
  "helloWorld": "Сәлам, дөнья!"
}
```

Русча тәрҗемәне `public/locales/ru/translation.json` файлга язабыз:
```json
{
  "helloWorld": "Здравствуй, мир!"
}
```

Тәрҗемә файлларны ясагач соң без битне браузерда яңарта алабыз. Шуннан соң
биттә тел сайлавы эшләргә тиеш. Ләкин, бу ысулда бер проблем бар, бу проблем
турында — киләсе бүлектә.

## Кәшкә бәйле проблемнар
Әйтик, без кушымтаның яңа версияне серверга урнаштык һәм браузерда яңа
JavaScript эшли,  ләкин иске тәрҗемә файллар куланыла (шуңа күрә
иске тәрҗемәләр яисә тәрҗемә ачкычлары күрәнелә).

Моның бер сәбәбе кәш булырга мөмкин: иске тәрҗемә файллар браузерда кәшләнгән
булсалар, браузер иске файлларны кулланырга мөмкин.

Бер чишелеш буларак без тәрҗемә файллар кәшләүне тулысынча тыерга алабыз.
Моны сервер көйләүләр белән дә, `i18next-http-backend`-ның `requestOptions`
көйләве белән дә, хәтта хәзерге вакытны тәрҗемә файлның йөкләү URL-га
кушып та була. Соңгы ысулны [бу StackOverflow җаваптан][stackoverflow-cb] алып
`i18next-http-backend`-та шулай ясап була:
{% raw %}
```js
{
  loadPath: '/locales/{{lng}}/{{ns}}.json?cb=' + new Date().getTime(),
}
```
{% endraw %}

Ләкин, кәшләүне тыю --- яхшы бер чишелеш түгел чөнки битнең һәр йөкләве
белән тәрҗемә файллар яңадан йөклиячәкләр.

Иң яхшы чишелеш ул кәшләүне дөрес көйләргә. Моны да берничә рәвештә
дә ясап була һәм бу язмышта без Rails-ның гадәти коралны кулланачакбыз.
Аның исеме файлүткәргеч.

## Файлүткәргечне `i18next` тәрҗемә файллар кәшләү өчен куллану
Бу бүлектә Ruby on Rails-ның файлүткәргеч белән файл исемнәрне әйләндерү
([filename revving][sauders-rev]) каралачак.

Файлүткәргеч файл исемгә аның эчтәлекнең һәшне [куша][asset-pipeline-fingerprinting],
шуңа күрә клиентлар шундый һәшле исемле файлларны мәңгегә кәшли алалар.
Әгәр файлның яңа бер версия килеп чыгачак, аның башка исеме булачак һәм
клиентлар бу башка исеме белән яңа версияне йөклиячәкләр.

Хәзер без файлларны ничек файлүткәргечкә җибәрергә һәм аларны ничек
`i18next-http-backend` белән файлүткәргечтән алырга карачакбыз.

### Файлларны файлүткәргечке җибәрү
Файлүткәргеч файлларны `app/assets` директорийдан ала, шуңа күрә
безгә файлларны `public` директорийдан `app/assets/` директорийга күчерергә
кирәк. Ягъни безнең бу ике файл булачак:
* `app/assets/locales/tt/translation.json`
* `app/assets/locales/ru/translation.json`

Файлүткәргеч файлларны күрәме-юкмы икәнен, консольда тикшерегез (`bundle exec rails c`):
```console?lang=ruby
> ActionController::Base.helpers.asset_path('tt/translation.json')
"/assets/tt/translation-8abc3942c062c7f43a1409665fcea91711a8864e4c03adfbf28ccd4ded8d99f8.json"
```

Әгәр сез файл исемен урында `Sprockets::Rails::Helper::AssetNotPrecompiled` хатаны күрсәгез:
```console?lang=ruby
> ActionController::Base.helpers.asset_path('tt/translation.json')
Traceback (most recent call last):
        1: from (irb):1
Sprockets::Rails::Helper::AssetNotPrecompiled (tt/translation.json)
```

Алайса бәлки сез Sprockets 4-ны кулланасыз һәм сезгә әссет манифест файлны
үзгәртергә кирәк.

#### Sprockets 4 өчен әссет манифест файлны үзгәртү
`sprockets` гемнең версиягә карап, сезгә киләсе адымны ясарга кирәк яки кирәкми.
Гемнең версияне бу боерык белән карап була:
```shell
bundle info sprockets
```

Проектыгызда Sprockets-ның 4-нче версиясе булса, сезгә локаль директорийны
`app/assets/config/manifest.js` манифест файлга кушырга кирәк:
```js
//= link_tree ../locales
```

Бу [Sprockets 4-тән башлап][sprockets-4-migration-guide] кирәк
(тәрҗемәсе һәм басымнар --- миннән):
> Әгәр сез sprockets 4.0-дан искерәк версияне куллансагыз, Rails
> `applications.css`, `application.js`, һәм әссет директорийдагы **һәр** 
> JS я CSS булмаган, файл исеме өстәмәле файлларны компиляцияләчәк.
>
> ...
>
> Әгәр сез Sprockets 4 куллансагыз, Rails башка компиляцияләү керү нокталар
> табу алгоритмны кулланачак: `./app/assets/config/manifest.js` файлдагы **гына**
> керү нокталар кулланачаклар.

### JavaScript-та файлүткәргечтән файлларны алу
Тәрҗемә файлларны файлүткәргечкә күчерүдән соң аларны төп исемнәр белән
(`/locales/tt/translation.json`) ала булмый. Күчерүдән соң аларның исемләргә
һәшне кушырга кирәк (`/assets/tt/translations-8ab...9f8.json`).

Шундый һәшле исемнәрне Ruby-да `asset_path` ярдәмче белән алырга мөмкин, ләкин
JavaScript-та аларны турыдан-туры алырга мөмкин түгел. Шулай ук, без Erb
өлгеләрне кулланып Ruby-да саналган кыйммәтләрне JavaScript кодка кыстыра алабыз.

Erb куллану тәэмин итү `webpacker`-га [рәсми күрсәтмәләр буенча][webpacker-erb] өстәгез.

`i18next-http-backend`-ның `loadPath` көйләү кыйммәте `(languages, namespaces) => loadPath`
функция дә булырга мөмкин. Шундый функциянең `languages` һәм `namespaces` көйләүләре
массивлар булса да, [аларның берәр элемент гына булачак][i18next-http-backend-lngs-nss]
(`allowMultiLoading` көйләве `false` булса, килешекәнчә ул шулай).

Үзебезнең `loadPath` функцияне `app/javascript/loadPath.js.erb` файлда языйк:
```erb?parent=js
const loadPath = (languages, namespaces) => {
  if (languages[0] === 'tt') {
    return '<%= ActionController::Base.helpers.asset_path("tt/translation.json") %>';
  }

  if (languages[0] === 'ru') {
    return '<%= ActionController::Base.helpers.asset_path("ru/translation.json") %>';
  }
  
  return undefined;
};

export default loadPath;
```

Һәм функцияне `app/javascript/packs/application.js` файлда `i18next`-ка бирик:
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

Хәзер сез браузерда битне яңадан яңарттыра аласыз һәм тел сайлау төймәләрне
куллана аласыз.

Нәкъ менә шулай. Интернациональләштерүдә бәхетле булуы телим :relaxed:

{% include refs/rails-react-asset-pipeline-caching.md %}
