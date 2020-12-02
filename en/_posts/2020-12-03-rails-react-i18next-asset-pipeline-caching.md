---
layout: post
title: "React i18next with Rails Asset Pipeline and efficient caching"
date: 2020-12-03
ref: rails-react-asset-pipeline-caching
---
How to use Ruby on Rails Asset Pipeline to serve and efficiently cache translation files.

Suppose you have a Ruby on Rails (Rails) application with frontend using React
(for example, with the [`react-rails` gem][react-rails]) and you want to add
internationalization to the frontend. There are several options for this.
You can implement the internationalization code yourself or you can pick
something already implemented.

While we talk about [the `i18next` package][i18next], the 
general idea of using the Asset Pipeline
should be applicable to other libraries or even to your own implementation
of the internationalization code.

While we talk about specific libraries, the mentioned problems and solutions
should apply to any tools you might use.

We will start by adding `react-i18next` to a `react-rails` application with
translation files located in the `public` directory, then we will
see the problems with caching of this approach, and finally we will move the translation
files to the Asset Pipeline to solve the problems of caching.

## Adding react-i18next to the application
In this section we will add `react-i18next` to the application and serve
the translation files as raw files from the `public` directory.

To start using i18next we need to add some dependencies:
```shell
yarn add i18next i18next-http-backend react-i18next
```

Initialize i18next in the pack files (e.g. `app/javascript/packs/application.js`):
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
`react-i18next` integrates `i18next` into the Rails world.

Now we can implement a basic demo with an internationalized "Hello, world!"
example:
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

If you render this component, you will see the string "helloWorld". This
is because we have not yet provided the translated version for this key and
`i18next` falls back to the key if the translation is not found.

Clicking on one of the two buttons should switch the language of the message.
Currently we will get the same fallback message because the translations are not
defined yet. Let's fix this problem.

By default, `i18next-http-backend` expects translation files to be available
at {% raw %}`/locales/{{lng}}/{{ns}}.json`{% endraw %} path
(see [the `loadPath` option][i18next-http-backend-options]),
where {% raw %}`{{lng}}`{% endraw %} is the language code
and {% raw %}`{{ns}}`{% endraw %} is the namespace (not covered in this post). The default namespace
is called `translation` (see [the `defaultNS` option][i18next-options-languages-namespaces-resources]).

In our case the server needs to provide two paths:
`/locales/en/translation.json` for the English version and `/locales/tt/translation.json`
for the Tatar version. We can put these files in the `public` directory and
they will be available at the required paths.

The English translations will be located in `public/locales/en/translation.json`:
```
{
  "helloWorld": "Hello, world!"
}
```

The Tatar translations will be located in `public/locales/tt/translation.json`:
```
{
  "helloWorld": "Сәлам, дөнья!"
}
```

With these files in place, you can refresh the page and observe the buttons working.
But there is a catch! Read further to see where this solution can break.

## The caching problem
When serving the translation files directly (like when serving from `public` in Rails), the clients
can have the newer version of the frontend code while still using the older version of the
translations from the cache. If the new code is deployed, it can reference the
new translations not present in the old translation files and by default `i18next`
will fall back to displaying the translation keys by default.

While there are ways to configure caching with the `requestOptions`
option of `i18next-http-backend`, it becomes your responsibility to
configure caching correctly.

One solution to this problem is disabling caching completely with server configurations,
or appending the current date to the download url like
[in this StackOverflow answer][stackoverflow-cb] (adapted to `i18next-http-backend`):
{% raw %}
```js
{
  loadPath: '/locales/{{lng}}/{{ns}}.json?cb=' + new Date().getTime(),
}
```
{% endraw %}
It is not optimal as on each refresh the translation files will be downloaded
once again.

Another approach is to use something like
[the `i18next-localstorage-backend` plugin][i18next-localstorage-backend]
and configuring a small enough expiration time so that the stale translations
are not used for long. However, with this approach there is still a possibility
that the old translations have not yet expired but the code is already updated.

We can also use the `versions` option of `i18next-localstorage-backend` to
update the translation files when the new version is released, but you
would need to bump the version on each change of the translations.

As an alternative, we can use a hash of the translation file as its version
so that the version will change each time there is a change in the translation
file. This approach is very similar to how digests work in the Asset Pipeline,
so read further to see this solution in action.

## Using Asset Pipeline to efficiently cache translations
In this post, we will use the Rails Asset Pipeline to [rev][sauders-rev] the
translation file paths. These days, Asset Pipeline
[appends][asset-pipeline-fingerprinting] a hash (fingerprint) of the file
contents to the file name. This way the clients can cache forever the current
version and they will download the new version if the new code which uses the new
hash of the translation files is deployed.

We will include the translation files in the Asset Pipeline and
use the `asset_path` Ruby helper to write the custom `loadPath` function in JavaScript.

### Including the translation files in the Asset Pipeline
To include the translations json files in the Asset Pipeline we just need
to move them from the `public` directory to `app/assets`. In our example,
these should result in two files located in these locations:
* `app/assets/locales/en/translation.json`
* `app/assets/locales/tt/translation.json`

You can check that the translation files are recognized by the Asset Pipeline
in the Rails console (`rails c`):
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
Depending on the `sprockets` gem version you might or might not to do the
following step. You can check the version by running:
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

### Using assets in JavaScript
After moving the translations to Asset Pipeline, they are not available by
their original filenames like `/locales/en/translation.json` but should be
accessed by their new names which include hashes like `/assets/en/translations-680...0f9.json`.

These new file names are available in Ruby using the `asset_path` helper
but they are not available directly in JavaScript. However, we can use Erb templates
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
