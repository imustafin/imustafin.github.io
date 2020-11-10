---
layout: post
title: "React Ant Design Direct File Upload to Active Storage with GraphQL in Ruby on Rails"
date: 2020-11-09
ref: ant-active-storage-upload
---
In this blog post I want to tell you how we implemented direct file uploads
to Ruby on Rails Active Storage from a React TypeScript application using
Ant Design with a GraphQL API.

## Problem
Ant Design Upload component's default behaviour is to make an HTTP request to
an upload url with customizeable headers. Backend server should handle such
request and store the file as needed.
{% raw %}
```jsx
import { Upload } from 'antd';

const Test = () => (
  <Upload
    name='avatar'
    action='https://example.com/avatar'
    headers={{ authorization: 'example' }}
  />
);
```
{% endraw %}

On the other hand, Ruby on Rails (Rails) suggests adding the file field in a Rails view:
```erb
<%= form.file_field :avatar, direct_upload: true %>
```

Which we did not want to integrate into our React code.

So, how to do an Active Storage direct file upload outside of Rails views
and controllers?

## Solution
The solution is based on articles
[Active Storage meets GraphQL: Direct Uploads](https://evilmartians.com/chronicles/active-storage-meets-graphql-direct-uploads),
[How to Use ActiveStorage Outside of a Rails View](https://cameronbothner.com/activestorage-beyond-rails-views/)
and [this StackOverflow answer](https://cameronbothner.com/activestorage-beyond-rails-views/).

We split the problem into two parts:
1. Generate the upload configuration and pass it to the frontend application
2. Direct upload with an Ant Upload component

### Generate the upload configuration and pass it to the frontend application

The options required for the direct upload depend on several properties of the
file to be uploaded:
* File name
* Content type
* Checksum (more on this [below](#frontend-javascript-typescript))
* File size

We will use a GraphQL mutation to pass these values to backend. The results
of the mutation will include the options needed for an upload.

#### Backend and GraphQL

We are using the [`graphql` gem](https://graphql-ruby.org/) as our backend GraphQL
library.

As we said before, we will have a mutation which takes the file's meta information
and gives the data required for an upload:
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

The `resolve` method will call some of Active Storage internals:
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

That's it, frontend would just need to do this migration and get the
upload url and the required headers in return.

#### Frontend JavaScript (TypeScript)
After we have the mutation defined we can implement the frontend part.

Mutation's arguments are self-explanatory except the the `checksum` argument.
The checksum string should be computed with a specific algorithm which is
provided in the [`@rails/activestorage` package](https://www.npmjs.com/package/@rails/activestorage).

**Bonus!** TypeScript typings are available with
the [`@types/rails__activestorage` package](https://www.npmjs.com/package/@types/rails__activestorage).

```ts
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

Ant Upload takes a `beforeUpload` function which we will use to get the upload
url for the file. In this example we will assume that a single file is uploaded.
As an example, we will store the results of the mutation in the state and
use it later.

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

Now we are ready to implement the custom XHR for the upload:
```ts
import { RcCustomRequestOptions } from 'antd/lib/upload/interface';

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

With `beforeUpload` and `customRequest` defined, we just need to use them in Upload:
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
      />
    );
  }
}
```

Don't forget to update the Rails routes. If you have a wildcard rule
to redirect all requests to React like this:

```ruby
match '*path', to: 'react#index', via: :all
```

Then you can exclude the Active Storage paths from this rule like this:

```ruby
match '*path', to: 'react#index', via: :all,
  constraints: ->(req) { req.path.exclude? 'rails/active_storage' }
```

And that's it. Happy direct uploading!
