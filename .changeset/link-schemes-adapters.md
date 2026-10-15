---
'@labre/affine-inline-link': patch
'@labre/affine-inline-footnote': patch
'@labre/affine-block-bookmark': patch
'@labre/affine-block-embed': patch
---

A link with a refused scheme (anything `isSafeLinkUrl` refuses: `javascript:`, `data:`, `vbscript:`…) is no longer stored by an import nor written by an export. The Markdown import makes no bookmark for such a footnote definition and drops the url of such a footnote reference; the HTML and Notion HTML imports keep an `<a>` link only for `http:` and `https:` by parsed scheme (the old prefix test let `httpx:` through) and store a Notion bookmark's refused href as an empty url; the Markdown and HTML exports write such a link, footnote url, bookmark or embed card as its text alone.
