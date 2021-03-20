---
layout: post
title: "Rails React Ant Direct File Upload with GraphQL"
date: 2020-11-09
last_modified_at: 2020-12-03
ref: ant-active-storage-upload
redirect_from:
  - /en/react-ant-rails-graphql-direct-upload.html
---
An implementation of direct file uploads
to Ruby on Rails Active Storage from a React TypeScript application using
Ant Design with a GraphQL API.

## Problem
On one hand, Ant Design provides a nice Upload component for choosing and
uploading files. Usually it is very is easy to use, just provide the upload URL
and Ant will make a POST request with the file attached.

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

On the other hand, Ruby on Rails (Rails) suggests adding the file field in a Rails view
and handling the form submission with a Rails controller which will automatically
handle the uploaded file.
```erb
<%= form.file_field :avatar %>
```

We were not using Rails views in this project before and the layout was rendered
only by React, because of this we needed some other way to upload files.

## Solution
The solution is based on articles
[Active Storage meets GraphQL: Direct Uploads](https://evilmartians.com/chronicles/active-storage-meets-graphql-direct-uploads),
[How to Use ActiveStorage Outside of a Rails View](https://cameronbothner.com/activestorage-beyond-rails-views/)
and [this StackOverflow answer](https://cameronbothner.com/activestorage-beyond-rails-views/).

An Active Storage direct upload happens in several steps:
1. Client extracts the file's metadata
2. Client sends the metadata to the Server
3. Server prepares an upload with the Service
4. Server sends the upload url and required headers to the Client
5. Client uploads the file to the Service using url and headers from the Server

In this example we are using a GraphQL API, so steps 2, 3, 4 will be implemented
as a GraphQL mutation.

### Server-side

The parameters of the direct upload depend on these metadata of the file:
* File name
* Content type
* Checksum (more on this [below](#client-side))
* File size

We will use a GraphQL mutation to pass these values to backend. The results
of the mutation will include the options needed for an upload.

We will pass these values to the mutation and result of the mutation
will have the values required for an upload (URL and headers) as well as
the blob ids.

We are using the [`graphql` gem](https://graphql-ruby.org/) as our implementation
of the GraphQL controller in Rails.

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

The `resolve` method will create the blob and return the parameters needed for
the upload:
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

Now the client can use this mutation to prepare a direct upload.

### Client-side
Mutation's arguments are self-explanatory except the the `checksum` argument.
The checksum string should be computed with a specific algorithm which is
provided in the [`@rails/activestorage` package](https://www.npmjs.com/package/@rails/activestorage).

**Bonus!** TypeScript typings are available with
the [`@types/rails__activestorage` package](https://www.npmjs.com/package/@types/rails__activestorage).

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

Ant Upload takes a `beforeUpload` function which we will use to get the upload
parameters. In this example we will assume that a single file is uploaded.
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

Now we are ready to implement a function which will do the direct upload XHR:
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

With `beforeUpload` and `customRequest` defined, we can use them in
Upload's hooks:
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

And that's it. Happy direct uploading :relaxed:
