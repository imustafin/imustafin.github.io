---
layout: post
title: "React-i18next in Rails: caching with Asset Pipeline"
date: 2020-12-03
last_modified_at: 2020-12-16
ref: rails-react-asset-pipeline-caching
---
How to use Ruby on Rails Asset Pipeline to efficiently cache translation files.

Here we will cover the simplest way of internationalizing
a `react-rails` application, then we will
discuss the caching problem of this approach,
and finally we will use the Asset Pipeline to achieve efficient caching
of the translation files.

## Adding react-i18next
In this section we will add `react-i18next` and serve
the translation files from the `public` directory.

First, let's add the required dependencies:
```shell
yarn add i18next i18next-http-backend react-i18next
```

Initialize `i18next` in the required pack files (e.g. `app/javascript/packs/application.js`):
```js
import i18n from 'i18next';
import I18nextHttpBackend from 'i18next-http-backend';
import { initReactI18next } from 'react-i18next';

i18n
  .use(I18nextHttpBackend)
  .use(initReactI18next)
  .init();
```

[The `i18next-http-backend` plugin][i18next-http-backend] is responsible
for downloading the needed translation files for the current language and
`react-i18next` makes `i18next` available to the React application itself.

Now we can implement an internationalized version of a "Hello, world!"
page with an option to switch the language:
```jsx
import React, { Suspense } from 'react';
import { useTranslation } from 'react-i18next';

const TranslatedHelloWorld = () => {
  const { t, i18n } = useTranslation();
  
  return (
    <>
      <h1>{t('helloWorld')}</h1>

      <button onClick={() => i18n.changeLanguage('en')}>
        English
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

If you look at the resulting page, you will see the string "helloWorld"
because we have not yet provided the translations for the `helloWorld` key and
`i18next` falls back to the key if the translation is not found.

By default, `i18next-http-backend` expects translation files to be available
at {% raw %}`/locales/{{lng}}/{{ns}}.json`{% endraw %} path
(see [the `loadPath` option][i18next-http-backend-options]),
where {% raw %}`{{lng}}`{% endraw %} is the language code
and {% raw %}`{{ns}}`{% endraw %} is the namespace. The default namespace
is called `translation` (see [the `defaultNS` option][i18next-options-languages-namespaces-resources]).

So, in our case the server needs to provide two paths:
`/locales/en/translation.json` for the English version and `/locales/tt/translation.json`
for the Tatar version. We can create the translation JSON files in the `public` directory and
they will be available at the required paths.

The English translations will be located in `public/locales/en/translation.json`:
```json
{
  "helloWorld": "Hello, world!"
}
```

The Tatar translations will be located in `public/locales/tt/translation.json`:
```json
{
  "helloWorld": "Сәлам, дөнья!"
}
```

With these files in place, you can refresh the page and observe the buttons working.
But there is a catch! Read further to see where this solution can break.

## Problems due to caching
You may notice that if you deploy a new version of your application,
browser runs the new version of your code, but sometimes
the old version of the translations are used, which results in
displaying the translation keys instead of the translations themselves.

This can be because of the old version of translation files being
cached.

One solution to this problem is disabling caching completely with server configurations,
disabling caching with the `requestOptions` option of `i18next-http-backend`,
or even appending the current date to the download URL like
[in this StackOverflow answer][stackoverflow-cb] (adapted to `i18next-http-backend`):
{% raw %}
```js
{
  loadPath: '/locales/{{lng}}/{{ns}}.json?cb=' + new Date().getTime(),
}
```
{% endraw %}

However, it is not optimal to disable caching
as on each refresh the translation files will be downloaded once again.

A better approach is to properly configure caching for the translation files.
This can be done in several ways and here we will talk about using
the default approach used in Rails for such tasks, the Asset Pipeline.

## Using Asset Pipeline for caching i18next translation files
In this section we will see how to use Rails Asset Pipeline to [rev][sauders-rev] the
translation file paths.

Asset Pipeline
[appends][asset-pipeline-fingerprinting] a hash of the file
contents to the file name, this way clients can cache such files forever and
when the new version will be released, it will have a different name and
clients will be able to download the new version by its new name.

Now we will pipe the translation files through the Asset Pipeline
and then configure `i18next-http-backend` to load files from the Asset Pipeline.

### Including the translation files in the Asset Pipeline
For translations JSON files to appear in the Asset Pipeline we just need
to move them from the `public` directory to `app/assets`. In our example,
these should result in two files located in these locations:
* `app/assets/locales/en/translation.json`
* `app/assets/locales/tt/translation.json`

You can check that the translation files are recognized by the Asset Pipeline
in the Rails console (`bundle exec rails c`):
```console?lang=ruby
> ActionController::Base.helpers.asset_path('en/translation.json')
"/assets/en/translation-6804b48978898b3301e60a2df30ae539fcf7d2370c47fe9ca3f440879163a0f9.json"
```

If instead you get the error `Sprockets::Rails::Helper::AssetNotPrecompiled`:
```console?lang=ruby
> ActionController::Base.helpers.asset_path('en/translation.json')
Traceback (most recent call last):
        1: from (irb):1
Sprockets::Rails::Helper::AssetNotPrecompiled (en/translation.json)
```

Then maybe you are using Sprockets 4, in this case you need to update
the manifest file.

#### Updating the asset manifest file for Sprockets 4
Depending on the `sprockets` gem version you might or might not
need to update the assets manifest file. You can check the version by running:
```shell
bundle info sprockets
```

If you are using Sprockets 4, then you must reference the locales directory in
the assets manifest file `app/assets/config/manifest.js` like this:
```js
//= link_tree ../locales
```

This is a change [introduced in Sprockets 4][sprockets-4-migration-guide] (emphasis by me):
> If you are using sprockets prior to 4.0, Rails will compile `application.css`, `application.js`;
> and **any** files found in your assets directory(ies) that are not recognized as JS or CSS,
> but do have a filename extension.
>
> ...
>
> If you are using Sprockets 4, Rails changes its default logic for determining top-level targets.
> It will now use **only** a file at `./app/assets/config/manifest.js` for specifying top-level targets;

### Getting Asset Pipeline paths in JavaScript
After moving the translations to Asset Pipeline, they are not available by
their original filenames like `/locales/en/translation.json` but should be
accessed by their new names which include hashes like `/assets/en/translations-680...0f9.json`.

These new file names are available in Ruby using the `asset_path` helper
but they are not available directly in JavaScript. Instead, we can use Erb templates
to substitute values computed by Ruby into JavaScript code.

Add Erb support to `webpacker` by following the [official instructions][webpacker-erb].

The `loadPath` configuration option of `i18next-http-backend` accepts a function
`(languages, namespaces) => loadPath`. While both `languages` and `namespaces`
are arrays, they [should contain only one element each][i18next-http-backend-lngs-nss] when 
the `allowMultiLoading` option is set to `false` (it is so by default).

Implement this custom `loadPath` function in `app/javascript/loadPath.js.erb`:
```erb?parent=js
const loadPath = (languages, namespaces) => {
  if (languages[0] === 'en') {
    return '<%= ActionController::Base.helpers.asset_path("en/translation.json") %>';
  }
  
  if (languages[0] === 'tt') {
    return '<%= ActionController::Base.helpers.asset_path("tt/translation.json") %>';
  }
  
  return undefined;
};

export default loadPath;
```

And pass it to `i18next` in your `app/javascript/packs/application.js`:
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

Now you can refresh the page and observe that the buttons work once again.

And that's it. Happy internationalization :relaxed:

{% include refs/rails-react-asset-pipeline-caching.md %}
