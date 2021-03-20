---
layout: post
title: "Rails React Ant-та GraphQL аша туры файл йөкләү"
date: 2020-11-15
last_modified_at: 2021-01-25
ref: ant-active-storage-upload
redirect_from:
  - /tt/react-ant-graphql-rails-туры-йөкләү.html
---
Ruby on Rails һәм Active Storage
серверга React TypeScript кушымтадан Ant Design һәм GraphQL API кулланып
туры файл йөкләү ясавы.

## Проблема
Бер яктан, Ant Design библиотекасының Upload компоненты файл сайлау һәм
серверга йөкләү өчен кулланыла ала. Гадәттә, бу компонентны куллану бик
җиңел: компонентка йөкләү URL-ны бирсәгез, Ant үзе файл кушып POST таләбе ясаячак.

```jsx
import { Upload, Button } from 'antd';

const Test = () => (
  <Upload
    name='avatar'
    action='https://example.com/avatar'
  >
    <Button>Click to Upload</Button>
  </Upload>
);
```

Икенче яктан, Rails файл йөкләү кырыны күрсәтелештә ясарга тәкъдим итә:
```erb
<%= form.file_field :avatar, direct_upload: true %>
```

Проектыбызда без Rails күрсәтелешләрне кулланмадык һәм бөтен разметканы React-та
гына ясадык. Шуңа күрә, безгә башка файл йөкләү ысулы кирәк.

## Чишелеш
Чишелешебез 
[Active Storage meets GraphQL: Direct Uploads](https://evilmartians.com/chronicles/active-storage-meets-graphql-direct-uploads),
[How to Use ActiveStorage Outside of a Rails View](https://cameronbothner.com/activestorage-beyond-rails-views/)
мәкаләләргә һәм [бу StackOverflow җавапка](https://cameronbothner.com/activestorage-beyond-rails-views/)
нигезләнә.

Active Storage-ның туры файл йөкләү берничә адымдан тора:
1. Клиент файлдан метамәгълүматны ала
2. Клиент метамәгълүматны серверга җибәрә
3. Сервер Сервис белән файл йөкләүне әзерли
4. Сервер Клиентка йөкләү URL-ны һәм кирәкле башламаларны җибәрә
5. Клиент йөкләү URL-ны һәм башламаларны кулланып Сервиска файлны йөкли

Бу үрнәктә без GraphQL-ны кулланабыз, шуңа күрә адымнар 2, 3, 4 GraphQL мутацияне
кулланачаклар.

### Сервер ягы
Йөкләү көйләүләре файл метамагълүматларга бәйле:
* Файл исеме
* Мәгълүмат тибы
* Контроль суммасы (моның турында [түбәндә карагыз](#клиент-ягы))
* Файл зурлыгы

Rails GraphQL контроллер ясау өчен без [`graphql` гемны](https://graphql-ruby.org)
кулланабыз.

Алдарак әйтелгәнчә, безнең бер мутациябез булачак һәм ул кирәкле файл метамәгълүматны алып,
кирәкле йөкләү көйләүләрне бирәчәк:
```ruby
module Mutations
  class CreateDirectUpload < BaseMutation
    argument :filename, String, required: true
    argument :byte_size, Int, required: true
    argument :checksum, String, required: true
    argument :content_type, String, required: true

    field :url, String, null: false
    field :headers, String, 'JSON of required HTTP headers', null: false
    field :blob_id, ID, null: false
    field :signed_blob_id, ID, null: false
  end
end
```

`resolve` ысулы блобны төзәчәк һәм йөкләү көйләүләрне кайтарачак:
```ruby
module Mutations
  class CreateDirectUpload < BaseMutation
    def resolve(filename:, byte_size:, checksum:, content_type:)
      blob = ActiveStorage::Blob.create_before_direct_upload!(
        filename: filename,
        byte_size: byte_size,
        checksum: checksum,
        content_type: content_type
      )

      {
        url: blob.service_url_for_direct_upload,
        headers: blob.service_headers_for_direct_upload.to_json,
        blob_id: blob.id,
        signed_blob_id: blob.signed_id
      }
    end
  end
end
```

Хәзер клиент бу мутацияне кулланып туры йөкләүне әзерли ала.

### Клиент ягы
Мутациянең `checksum`-дан бөтен параметрларның мәгънәсе ачык күренелә.
Контроль сумма юлы махсус ысулда төзеләргә тиеш. Бу ысул [`@rails/activestorage`
пакетында](https://www.npmjs.com/package/@rails/activestorage) урнашкан.

**Бонус!** TypeScript өчен тип билгеләмәләр
[`@types/rails__activestorage` пакетында](https://www.npmjs.com/package/@types/rails__activestorage)
торалар.

```ts
import { FileChecksum } from '@rails/activestorage/src/file_checksum';

const calculateChecksum = (file: File): Promise<string> => (
  new Promise((resolve, reject) => (
    FileChecksum.create(file, (error, checksum) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(checksum);
    })
  ))
);
```

Ant библиотекасындагы Upload компоненты `beforeUpload` функцияне ала, һәм без
бу функциядә сервердан йөкләү көйләүләрне алачакбыз. Бу үрнәктә без бер файл гына
йөклибез һәм көйләүләрне компонентның халәттә саклыйбыз.
```ts
import { RcFile } from 'antd/lib/upload';

class Test extends React.Component {
  async beforeUpload(file: RcFile): Promise<void> {
    // createDirectUploadMutation is a placeholder for your GraphQL request method
    const { url, headers } = createDirectUploadMutation({
      checksum: await calculateChecksum(file),
      filename: file.name.
      contentType: file.type,
      byteSize: file.size
    });

    this.setState({ url, headers: JSON.parse(headers) });
  }
}
```

Хәзер без туры йөкләү XHR таләп итә торган функцияне ясый алабыз:
```ts
import { RcCustomRequestOptions } from 'antd/lib/upload/interface';
import { BlobUpload } from '@rails/activestorage/src/blob_upload';

class Test extends React.Component {
  customRequest(options: RcCustomRequestOptions): void {
    const { file, action, headers } = options;

    const upload = new BlobUpload({
      file,
      directUploadData: {
        headers: headers as Record<string, string>;
        url: action;
      }
    });

    upload.xhr.addEventListener('progress', event => {
      const percent = (event.loaded / event.total) * 100;
      options.onProgress({ percent }, file);
    });

    upload.create((error: Error, response: object) => {
      if (error) {
        options.onError(error);
      } else {
        options.onSuccess(response, file);
      }
    });
  }
}
```

Аннары без `beforeUpload` һәм `customRequest` функцияләрне Upload компонентның
һукларында куллана алабыз:
```tsx
class Test extends React.Component {
  render() {
    return (
      <Upload
        method='put' // important!
        multiple={false}
        beforeUpload={(file): Promise<void> => this.beforeUpload(file)}
        action={this.state.url}
        customRequest={(options): void => this.customRequest(options)}
      >
        <Button>Click to Upload!</Button>
      </Upload>
    );
  }
}
```

Rails-ның юлларын яңартырга онытмагыз. Әгәр сез бөтен таләпләрне
React-ка юнәлешсәгез:
```ruby
match '*path', to: 'react#index', via: :all
```

Сез бу кагыйдән Active Storage юлларны шулай чыгара аласыз:
```ruby
match '*path', to: 'react#index', via: :all,
  constraints: ->(req) { req.path.exclude? 'rails/active_storage' }
```

Нәкъ менә шулай. Туры йөкләүләрегездә бәхетле булуыгызны телим :relaxed:
