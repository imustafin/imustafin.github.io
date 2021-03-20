---
layout: post
title: "Прямая загрузка файлов в Rails React Ant через GraphQL"
date: 2020-11-09
last_modified_at: 2020-12-03
ref: ant-active-storage-upload
redirect_from:
  - /ru/react-ant-rails-graphql-прямая-загрузка.html
---
Реализация прямой загрузки
файлов в Ruby on Rails Active Storage из React TypeScript приложения,
используя Ant Design и GraphQL API.

## Проблема
С одной стороны, компонент Upload библиотеки Ant Design позволяет выбирать и загружать файлы
на сервер. Обычно, использовать этот компонент очень легко: нужно всего лишь
указать URL для загрузки, и Ant сделает POST запрос с прикреплённым файлом.

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

С другой стороны, Rails предлагает создавать поле для загрузки файлов в представлении:
```erb
<%= form.file_field :avatar, direct_upload: true %>
```

В нашем проекте мы использовали представления Rails, а вся разметка создавалась
только внутри React. Поэтому нам нужно было найти другой способ для загрузки файлов.

## Решение
Наше решение основано на статьях
[Active Storage meets GraphQL: Direct Uploads](https://evilmartians.com/chronicles/active-storage-meets-graphql-direct-uploads),
[How to Use ActiveStorage Outside of a Rails View](https://cameronbothner.com/activestorage-beyond-rails-views/)
и [этом ответе со StackOverflow](https://cameronbothner.com/activestorage-beyond-rails-views/).

Прямая загрузка в Acitve Storage происходит в несколько этапов:
1. Клиент извлекает метаданные файла
2. Клиент отправляет метаданные на Сервер
3. Сервер подготавливает загрузку вместе с Сервисом
4. Сервер отправляет URL для загрузки и необходимые заголовки Клиенту
5. Клиент загружает файл на Сервис, используя URL и заголовки, полученные с Сервера

В этом примере мы используем GraphQL, поэтому шаги 2, 3, 4 будут реализованны
через GraphQL мутацию.

### Серверная часть

Параметры для прямой загрузки зависят от этих метаданных файла:
* Имя файла
* Тип данных
* Контрольная сумма (подробнее о ней [ниже](#клиентская-часть))
* Размер файла

Мы будем передавать эти данные в мутацию, а клиент в ответ будет получать
конкретные параметры для загрузки (URL и заголовки), а также идентификаторы
блоба.

Мы используем [гем `graphql`](https://graphql-ruby.org) для реализации GraphQL
контроллера в Rails.

Как мы уже говорили раньше, у нас будет мутация, которая берёт необходимые
метаданные файла и даёт данные, необходимые для загрузки:
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

Метод `resolve` будет создавать блоб и возвращать необходимые для загрузки данные:
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

Теперь клиент сможет использовать эту мутацию чтобы подготовить прямую загрузку.

### Клиентская часть
Все параметры мутации не требуют пояснений, за исключением параметра `checksum`.
Строка контрольной суммы должна вычисляться по особому алгоритму, который
доступен в [пакете `@rails/activestorage`](https://www.npmjs.com/package/@rails/activestorage).

**Бонус!** Объявления типов для TypeScript доступны в
[пакете `@types/rails__activestorage`](https://www.npmjs.com/package/@types/rails__activestorage).

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

Компонент Upload библиотеки Ant принимает функцию `beforeUpload`, в которой
мы и будем получать параметры для загрузки с сервера. В этом примере мы
будем загружать один файл и будем сохранять необходимые параметры в состоянии
компонента чтобы использовать их чуть позже.
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

Сейчас мы можем реализовать функцию, которая выполнит XHR для прямой загрузки:
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

Далее, когда у нас есть функции `beforeUpload` и `customRequest`, мы
можем использовать их в хуках компонента Upload:
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

Не забудьтье обновить маршруты Rails. Если вы перенаправляете все запросы
в React:
```ruby
match '*path', to: 'react#index', via: :all
```

То вы можете исключить маршруты для Active Storage из этого правила:
```ruby
match '*path', to: 'react#index', via: :all,
  constraints: ->(req) { req.path.exclude? 'rails/active_storage' }
```

Вот и всё. Желаю вам счастливых прямых загрузок :relaxed:
