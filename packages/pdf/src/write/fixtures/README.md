# Protected PDFs for `crypt.browser.spec.ts`

Made with MuPDF (`npm install mupdf@1.26.4` in a scratch folder, not a dependency): one page with the text
“Protected page” and a note by “Ada” saying “Hello encrypted”, saved with the owner password `owner`, no user
password and permissions `-3904` (no printing, copying, changing) – the `user-*` files with a user password too:

| File | `saveToBuffer` options |
|---|---|
| `rc4-40.pdf` | `encrypt=rc4-40,owner-password=owner,permissions=-3904` |
| `rc4-128.pdf` | `encrypt=rc4-128,owner-password=owner,permissions=-3904` |
| `aes-128.pdf` | `encrypt=aes-128,owner-password=owner,permissions=-3904,objstms,compress` |
| `aes-256.pdf` | `encrypt=aes-256,owner-password=owner,permissions=-3904,objstms,compress` |
| `user-password.pdf` | `encrypt=aes-128,owner-password=owner,user-password=secret` |
| `user-rc4-40.pdf` | `encrypt=rc4-40,owner-password=owner,user-password=secret` |
| `user-rc4-128.pdf` | `encrypt=rc4-128,owner-password=owner,user-password=secret` |
| `user-aes-256.pdf` | `encrypt=aes-256,owner-password=owner,user-password=secret,objstms,compress` |
| `user-aes-256-umlaut.pdf` | `encrypt=aes-256,owner-password=owner,user-password=Grüße,objstms,compress` |

```js
import * as mupdf from 'mupdf';
const doc = new mupdf.PDFDocument();
const font = doc.addSimpleFont(new mupdf.Font('Helvetica'));
const page = doc.addPage([0, 0, 595, 842], 0, doc.addObject({ Font: { F1: font } }), 'BT /F1 24 Tf 72 700 Td (Protected page) Tj ET');
doc.insertPage(-1, page);
const note = doc.loadPage(0).createAnnotation('Text');
note.setRect([100, 600, 120, 620]);
note.setContents('Hello encrypted');
note.setAuthor('Ada');
note.update();
// doc.saveToBuffer(options).asUint8Array() → the file
```
