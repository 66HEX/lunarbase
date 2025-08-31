# Embed Inline Images

> Send emails with inline images.

You can optionally embed an image in the HTML body of the email. This allows you to include images without needing to host them in an external server.

<Info>
  We currently do not support sending attachments (including inline images)
  [when using our batch endpoint](/api-reference/emails/send-batch-emails).
</Info>

<Steps>
  <Step title="Add the CID in the email HTML.">
    Use the prefix `cid:` to reference the ID in the `src` attribute of an image tag in the HTML body of the email.

    ```html
      <img src="cid:logo-image">
    ```
  </Step>

  <Step title="Reference the CID in the attachment">
    Include the `content_id` parameter in the attachment object (e.g. `content_id: "logo-image"`).

    ```bash
    "attachments": [
        {
          "path": "https://resend.com/static/sample/logo.png",
          "filename": "logo.png",
          "content_id": "logo-image"
        }
      ]
    ```

    The ID is an arbitrary string set by you, and must be less than 128 characters.
  </Step>
</Steps>

## Implementation details

Both remote and local attachments are supported. All attachment [requirements, options, and limitations](/dashboard/emails/attachments) apply to inline images as well.

As with all our features, inline images are available across all our SDKs.

### Remote image example

<CodeGroup>
  ```ts Node.js {9, 14}
  import { Resend } from 'resend';

  const resend = new Resend('re_xxxxxxxxx');

  await resend.emails.send({
    from: 'Acme <onboarding@resend.dev>',
    to: ['delivered@resend.dev'],
    subject: 'Thank you for contacting us',
    html: '<p>Here is our <img src="cid:logo-image"/> inline logo</p>',
    attachments: [
      {
        path: 'https://resend.com/static/sample/logo.png',
        filename: 'logo.png',
        contentId: 'logo-image',
      },
    ],
  });
  ```

  ```php PHP {7,12}
  $resend = Resend::client('re_xxxxxxxxx');

  $resend->emails->send([
    'from' => 'Acme <onboarding@resend.dev>',
    'to' => ['delivered@resend.dev'],
    'subject' => 'Thank you for contacting us',
    'html' => '<p>Here is our <img src="cid:logo-image"/> inline logo</p>',
    'attachments' => [
      [
        'path' => 'https://resend.com/static/sample/logo.png',
        'filename' => 'logo.png',
        'content_id' => 'logo-image',
      ]
    ]
  ]);
  ```

  ```python Python {8,15}
  import resend

  resend.api_key = "re_xxxxxxxxx"

  attachment: resend.RemoteAttachment = {
    "path": "https://resend.com/static/sample/logo.png",
    "filename": "logo.png",
    "content_id": "logo-image",
  }

  params: resend.Emails.SendParams = {
    "from": "Acme <onboarding@resend.dev>",
    "to": ["delivered@resend.dev"],
    "subject": "Thank you for contacting us",
    "html": "<p>Here is our <img src=\"cid:logo-image\"/> inline logo</p>",
    "attachments": [attachment],
  }

  resend.Emails.send(params)
  ```

  ```rb Ruby {9, 14}
  require "resend"

  Resend.api_key = "re_xxxxxxxxx"

  params = {
    "from": "Acme <onboarding@resend.dev>",
    "to": ["delivered@resend.dev"],
    "subject": "Thank you for contacting us",
    "html": "<p>Here is our <img src=\"cid:logo-image\"/> inline logo</p>",
    "attachments": [
      {
        "path": "https://resend.com/static/sample/logo.png",
        "filename": 'logo.png',
        "content_id": "logo-image",
      }
    ]
  }

  Resend::Emails.send(params)
  ```

  ```go Go {14, 21}
  import (
  	"fmt"

  	"github.com/resend/resend-go/v2"
  )

  func main() {
    ctx := context.TODO()
    client := resend.NewClient("re_xxxxxxxxx")

    attachment := &resend.Attachment{
      Path:  "https://resend.com/static/sample/logo.png",
      Filename: "logo.png",
      ContentId: "logo-image",
    }

    params := &resend.SendEmailRequest{
        From:        "Acme <onboarding@resend.dev>",
        To:          []string{"delivered@resend.dev"},
        Subject:     "Thank you for contacting us",
        Html:        "<p>Here is our <img src=\"cid:logo-image\"/> inline logo</p>",
        Attachments: []*resend.Attachment{attachment},
    }

    sent, err := client.Emails.SendWithContext(ctx, params)

    if err != nil {
      panic(err)
    }
    fmt.Println(sent.Id)
  }
  ```

  ```rust Rust {14, 17}
  use resend_rs::types::{Attachment, CreateEmailBaseOptions};
  use resend_rs::{Resend, Result};

  #[tokio::main]
  async fn main() -> Result<()> {
    let resend = Resend::new("re_xxxxxxxxx");

    let from = "Acme <onboarding@resend.dev>";
    let to = ["delivered@resend.dev"];
    let subject = "Thank you for contacting us";

    let path = "https://resend.com/static/sample/logo.png";
    let filename = "logo.png";
    let content_id = "logo-image";

    let email = CreateEmailBaseOptions::new(from, to, subject)
      .with_html("<p>Here is our <img src=\"cid:logo-image\"/> inline logo</p>")
      .with_attachment(Attachment::from_path(path).with_filename(filename).with_content_id(content_id));

    let _email = resend.emails.send(email).await?;

    Ok(())
  }
  ```

  ```java Java {10, 17}
  import com.resend.*;

  public class Main {
      public static void main(String[] args) {
          Resend resend = new Resend("re_xxxxxxxxx");

          Attachment att = Attachment.builder()
                  .path("https://resend.com/static/sample/logo.png")
                  .fileName("logo.png")
                  .ContentId("logo-image")
                  .build();

          CreateEmailOptions params = CreateEmailOptions.builder()
                  .from("Acme <onboarding@resend.dev>")
                  .to("delivered@resend.dev")
                  .subject("Thank you for contacting us")
                  .html("<p>Here is our <img src=\"cid:logo-image\"/> inline logo</p>")
                  .attachments(att)
                  .build();

          CreateEmailResponse data = resend.emails().send(params);
      }
  }
  ```

  ```csharp .NET {11, 18}
  using Resend;
  using System.Collections.Generic;

  IResend resend = ResendClient.Create( "re_xxxxxxxxx" ); // Or from DI

  var message = new EmailMessage()
  {
      From = "Acme <onboarding@resend.dev>",
      To = "delivered@resend.dev",
      Subject = "Thank you for contacting us",
      HtmlBody = "<p>Here is our <img src=\"cid:logo-image\"/> inline logo</p>",
  };

  message.Attachments = new List<EmailAttachment>();
  message.Attachments.Add( new EmailAttachment() {
    Filename = "logo.png",
    Path = "https://resend.com/static/sample/logo.png",
    ContentId = "logo-image",
  } );

  var resp = await resend.EmailSendAsync( message );
  Console.WriteLine( "Email Id={0}", resp.Content );
  ```

  ```bash cURL {8,13}
  curl -X POST 'https://api.resend.com/emails' \
       -H 'Authorization: Bearer re_xxxxxxxxx' \
       -H 'Content-Type: application/json' \
       -d $'{
    "from": "Acme <onboarding@resend.dev>",
    "to": ["delivered@resend.dev"],
    "subject": "Thank you for contacting us",
    "html": "<p>Here is our <img src=\"cid:logo-image\"/> inline logo</p>",
    "attachments": [
      {
        "path": "https://resend.com/static/sample/logo.png",
        "filename": "logo.png",
        "content_id": "logo-image"
      }
    ]
  }'
  ```
</CodeGroup>

### Local image example

<CodeGroup>
  ```ts Node.js {13, 18}
  import { Resend } from 'resend';
  import fs from 'fs';

  const resend = new Resend('re_xxxxxxxxx');

  const filepath = `${__dirname}/static/logo.png`;
  const attachment = fs.readFileSync(filepath).toString('base64');

  await resend.emails.send({
    from: 'Acme <onboarding@resend.dev>',
    to: ['delivered@resend.dev'],
    subject: 'Thank you for contacting us',
    text: '<p>Here is our <img src="cid:logo-image"/> inline logo</p>',
    attachments: [
      {
        content: attachment,
        filename: 'logo.png',
        content_id: 'logo-image',
      },
    ],
  });
  ```

  ```php PHP {7, 12}
  $resend = Resend::client('re_xxxxxxxxx');

  $resend->emails->send([
    'from' => 'Acme <onboarding@resend.dev>',
    'to' => ['delivered@resend.dev'],
    'subject' => 'Thank you for contacting us',
    'html' => '<p>Here is our <img src="cid:logo-image"/> inline logo</p>',
    'attachments' => [
      [
        'filename' => 'logo.png',
        'content' => $invoiceBuffer,
        'content_id' => 'logo-image',
      ]
    ]
  ]);
  ```

  ```python Python {10, 16}
  import os
  import resend

  resend.api_key = "re_xxxxxxxxx"

  f: bytes = open(
    os.path.join(os.path.dirname(__file__), "../static/logo.png"), "rb"
  ).read()

  attachment: resend.Attachment = {"content": list(f), "filename": "logo.png", "content_id": "logo-image"}

  params: resend.Emails.SendParams = {
    "from": "Acme <onboarding@resend.dev>",
    "to": ["delivered@resend.dev"],
    "subject": "Thank you for contacting us",
    "html": "<p>Here is our <img src=\"cid:logo-image\"/> inline logo</p>",
    "attachments": [attachment],
  }

  resend.Emails.send(params)
  ```

  ```rb Ruby {11,16}
  require "resend"

  Resend.api_key = "re_xxxxxxxxx"

  file = IO.read("logo.png")

  params = {
    "from": "Acme <onboarding@resend.dev>",
    "to": ["delivered@resend.dev"],
    "subject": "Thank you for contacting us",
    "html": "<p>Here is our <img src=\"cid:logo-image\"/> inline logo</p>",
    "attachments": [
      {
        "content": file.bytes,
        "filename": 'logo.png',
        "content_id": "logo-image",
      }
    ]
  }

  Resend::Emails.send(params)
  ```

  ```go Go {21, 28}
  import (
  	"fmt"
  	"os"

  	"github.com/resend/resend-go/v2"
  )

  func main() {
    ctx := context.TODO()
    client := resend.NewClient("re_xxxxxxxxx")

    pwd, _ := os.Getwd()
    f, err := os.ReadFile(pwd + "/static/logo.png")
    if err != nil {
      panic(err)
    }

    attachment := &resend.Attachment{
      Content:  f,
      Filename: "logo.png",
      ContentId: "logo-image",
    }

    params := &resend.SendEmailRequest{
        From:        "Acme <onboarding@resend.dev>",
        To:          []string{"delivered@resend.dev"},
        Subject:     "Thank you for contacting us",
        Html:        "<p>Here is our <img src=\"cid:logo-image\"/> inline logo</p>",
        Attachments: []*resend.Attachment{attachment},
    }

    sent, err := client.Emails.SendWithContext(ctx, params)

    if err != nil {
      panic(err)
    }
    fmt.Println(sent.Id)
  }
  ```

  ```rust Rust {16,22}
  use std::fs::File;
  use std::io::Read;

  use resend_rs::types::{Attachment, CreateEmailBaseOptions};
  use resend_rs::{Resend, Result};

  #[tokio::main]
  async fn main() -> Result<()> {
    let resend = Resend::new("re_xxxxxxxxx");

    let from = "Acme <onboarding@resend.dev>";
    let to = ["delivered@resend.dev"];
    let subject = "Thank you for contacting us";

    let filename = "logo.png";
    let content_id = "logo-image";
    let mut f = File::open(filename).unwrap();
    let mut invoice = Vec::new();
    f.read_to_end(&mut invoice).unwrap();

    let email = CreateEmailBaseOptions::new(from, to, subject)
      .with_html("<p>Here is our <img src=\"cid:logo-image\"/> inline logo</p>")
      .with_attachment(Attachment::from_content(invoice).with_filename(filename).with_content_id(content_id));

    let _email = resend.emails.send(email).await?;

    Ok(())
  }
  ```

  ```java Java {10, 17}
  import com.resend.*;

  public class Main {
      public static void main(String[] args) {
          Resend resend = new Resend("re_xxxxxxxxx");

          Attachment att = Attachment.builder()
                  .fileName("logo.png")
                  .content("invoiceBuffer")
                  .contentId("logo-image")
                  .build();

          CreateEmailOptions params = CreateEmailOptions.builder()
                  .from("Acme <onboarding@resend.dev>")
                  .to("delivered@resend.dev")
                  .subject("Thank you for contacting us")
                  .html("<p>Here is our <img src=\"cid:logo-image\"/> inline logo</p>")
                  .attachments(att)
                  .build();

          CreateEmailOptions params = CreateEmailOptions.builder()
      }
  }
  ```

  ```csharp .NET {12, 19}
  using Resend;
  using System.Collections.Generic;
  using System.IO;

  IResend resend = ResendClient.Create( "re_xxxxxxxxx" ); // Or from DI

  var message = new EmailMessage()
  {
      From = "Acme <onboarding@resend.dev>",
      To = "delivered@resend.dev",
      Subject = "Thank you for contacting us",
      HtmlBody = "<p>Here is our <img src=\"cid:logo-image\"/> inline logo</p>",
  };

  message.Attachments = new List<EmailAttachment>();
  message.Attachments.Add( new EmailAttachment() {
    Filename = "logo.png",
    Content = await File.ReadAllBytesAsync( "logo.png" ),
    ContentId = "logo-image",
  } );

  var resp = await resend.EmailSendAsync( message );
  Console.WriteLine( "Email Id={0}", resp.Content );
  ```

  ```bash cURL {8, 13}
  curl -X POST 'https://api.resend.com/emails' \
       -H 'Authorization: Bearer re_xxxxxxxxx' \
       -H 'Content-Type: application/json' \
       -d $'{
    "from": "Acme <onboarding@resend.dev>",
    "to": ["delivered@resend.dev"],
    "subject": "Thank you for contacting us",
    "html": "<p>Here is our <img src=\"cid:logo-image\"/> inline logo</p>",
    "attachments": [
      {
        "content": "UmVzZW5kIGF0dGFjaG1lbnQgZXhhbXBsZS4gTmljZSBqb2Igc2VuZGluZyB0aGUgZW1haWwh%",
        "filename": "invoice.txt",
        "content_id": "logo-image"
      }
    ]
  }'
  ```
</CodeGroup>

## Other considerations

Before adding inline images, consider the following.

* As these images are sent as attachments, you need to encode your image as Base64 when sending the raw content via the API. There is no need to do this when passing the path of a remote image (the API handles this for you).
* Inline images increase the size of the email.
* Inline images may be rejected by some clients (especially webmail).
* As with all attachments, we recommend adding a `content_type` (e.g. `image/png`) or `filename` (e.g. `logo.png`) parameter to the attachment object, as this often helps email clients render the attachment correctly.

<Note>
  All attachments (including inline images) do not currently display in the
  [emails dashboard](https://resend.com/emails) when previewing email HTML.
</Note>
