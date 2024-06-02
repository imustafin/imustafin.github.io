# Ilgiz Mustafin's personal website

**Welcome! Рәхим итегез! Добро пожаловать!**

This repository contains the source code of my personal website.

See it live at <https://imustafin.tatar/>!

## Installation
### Info for `jekyll_picture_tag`
Requires system `libvips`.

Requires `width: 100%; height: auto` for `img` tags
<https://rbuchberger.github.io/jekyll_picture_tag/users/presets/writing_presets.html#5-consider-enabling-dimension-attributes>:
> Make sure your CSS is correct. You need something like `width: 100%`
> and `height: auto`
> (which is why they aren't turned on by default.)
> Without this step, you'll get crazy sizes and/or stretched images.

This is done by Tailwind preflight <https://tailwindcss.com/docs/preflight#images-are-constrained-to-the-parent-width>:
> Images and videos are constrained to the parent width in a way
> that preserves their intrinsic aspect ratio.
> ```
> img,
> video {
>   max-width: 100%;
>   height: auto;
> }
> ```

## RDFa Resources
| id | Schema.org type | Description |
|----|-----------------|-------------|
| /  | WebPage | EN homepage, canonical is with `/`, use it in links |
| /ru/ | WebPage | RU homepage, canonical is with trailing `/`, use it in links |
| /tt/ | WebPage | TT homepage, canonical is with trailing `/`, use it in links |
| /#site | Website | The website imustafin.tatar in English |
| /ru/#site | Website | The website imustafin.tatar in Russian (everything under /ru/) |
| /tt/#site | Website | The website imustafin.tatar in Tatar (everything under /tt/) |
| /#i    | Person  | The person Ilgiz in all languages |
