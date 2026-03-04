---
# this is YAML front matter
author: James Smith
summary: This is a summary
topics: list, of, topics
variable: one
array:
  - one thing
  - two things
  - several things
# all of this data is available to our layout
---

# Markdown Test Document

## Bullet list

This is a test unordered list with mixed bullets:

* First item with a number 2. in it
* Second item
* Third item
    - Indented item
    - Indented item
* Fourth item 

Another unordered list:

- 1st item
- 2nd item
- third item containing _italic_ text
  - indented item
  - second indented item
- fourth item

This is a test ordered list with indented items:

1. First item
2. Second item
3. Third item
    1. Indented item
    2. Indented item
4. Fourth item

Ordered list that is wrongly numbered:

1. First item
8. Second item
3. Third item
5. Fourth item

This is a mixed list with indented items:

1. First item
2. Second item
3. Third item
    * Indented item
    * Indented item
4. Fourth item

This is another mixed list with indented items:

- First item
- Second item
- Third item
    1. Indented item
    2. Indented item
- Fourth item

## Headers

### Third-level header

#### Fourth-level header

##### Fifth-level header

###### Sixth-level header

## Media and Links

### Nostr address

This should be ignored and rendered as plaintext: naddr1qvzqqqr4gupzplfq3m5v3u5r0q9f255fdeyz8nyac6lagssx8zy4wugxjs8ajf7pqyghwumn8ghj7mn0wd68ytnvv9hxgtcqy4sj6ar9wd6xv6tvv5kkvmmj94kkzuntv3hhwm3dvfuj6enyxgcrset98p3nsve2v5l

This is also plaintext:

npub1gv069u6q7zkl393ad47xutpqmyfj0rrfrlnqnlfc2ld38k8nnl4st9wa6q

These should be turned into links:

nostr:naddr1qvzqqqr4gupzplfq3m5v3u5r0q9f255fdeyz8nyac6lagssx8zy4wugxjs8ajf7pqyghwumn8ghj7mn0wd68ytnvv9hxgtcqy4sj6ar9wd6xv6tvv5kkvmmj94kkzuntv3hhwm3dvfuj6enyxgcrset98p3nsve2v5l

nostr:npub1l5sga6xg72phsz5422ykujprejwud075ggrr3z2hwyrfgr7eylqstegx9z

nostr:nevent1qvzqqqqqqypzp382htsmu08k277ps40wqhnfm60st89h5pvjyutghq9cjasuh38qqythwumn8ghj7un9d3shjtnswf5k6ctv9ehx2ap0qqsysletg3lqnl4uy59xsj4rp9rgw67wg23l827f4uvn5ckn20fuxcq45d8pj

nostr:nprofile1qqsxhedgkuneycxpcdjlg6tgtxdy8gurdz64nq2h0flc288a0jag98qguy3nh

nostr:note1txyefcha2xt3pgungx4k6j077dsteyef6hzpyuuku00s4h0eymzq4k33yg

### Hashtag

#testhashtag at the start of the line and #inlinehashtag in the middle

### Wikilinks

[[NKBIP-01|Specification]] and [[mirepoix]]

### URL

https://www.welt.de/politik/ausland/article69a7ca00ad41f3cd65a1bc63/iran-drohte-jedes-schiff-zu-verbrennen-trump-will-oel-tanker-durch-strasse-von-hormus-eskortieren.html

[Welt Online link](https://www.welt.de/politik/ausland/article69a7ca00ad41f3cd65a1bc63/iran-drohte-jedes-schiff-zu-verbrennen-trump-will-oel-tanker-durch-strasse-von-hormus-eskortieren.html)

this should render as plaintext: `http://www.example.com`

this shouild be a hyperlink to the http URL with the same address [wss://theforest.nostr1.com](https://theforest.nostr1.com)

### Images

https://blog.ronin.cloud/content/images/size/w2000/2022/02/markdown.png

![test image](https://blog.ronin.cloud/content/images/size/w2000/2022/02/markdown.png)

### Media

#### YouTube

https://youtube.com/shorts/ZWfvChb-i0w

#### Spotify

https://open.spotify.com/episode/1GSZFA8vWltPyxYkArdRKx?si=bq6-az28TcuP596feTkRFQ

#### Audio

https://media.blubrry.com/takeituneasy/ins.blubrry.com/takeituneasy/lex_ai_rick_beato.mp3

#### Video

https://v.nostr.build/MTjaYib4upQuf8zn.mp4

## Tables

### Orderly

| Syntax      | Description |
| ----------- | ----------- |
| Header      | Title       |
| Paragraph   | Text        |

### Unorderly

| Syntax | Description |
| --- | ----------- |
| Header | Title |
| Paragraph | Text |

## Code blocks

### json

```json
{
    "id": "<event_id>",
    "pubkey": "<event_originator_pubkey>",
    "created_at": 1725087283,
    "kind": 30040,
    "tags": [
        ["d", "aesop's-fables-by-aesop"],
        ["title", "Aesop's Fables"],
        ["author", "Aesop"],
    ],
    "sig": "<event_signature>"
}
```

### typescript

```typescript
/**
 * Get Nostr identifier type
 */
function getNostrType(id: string): 'npub' | 'nprofile' | 'nevent' | 'naddr' | 'note' | null {
  if (id.startsWith('npub')) return 'npub';
  if (id.startsWith('nprofile')) return 'nprofile';
  if (id.startsWith('nevent')) return 'nevent';
  if (id.startsWith('naddr')) return 'naddr';
  if (id.startsWith('note')) return 'note';
  return null;
}
```

### shell

```shell

mkdir new_directory
cp source.txt destination.txt

```

### LaTeX

```latex
$$
M = 
\begin{bmatrix}
\frac{5}{6} & \frac{1}{6} & 0 \\[0.3em]
\frac{5}{6} & 0 & \frac{1}{6} \\[0.3em]
0 & \frac{5}{6} & \frac{1}{6}
\end{bmatrix}
$$
```

## LateX

### LaTex in inline-code

`$[ x^n + y^n = z^n \]$` and `$[\sqrt{x^2+1}\]$` and `$\color{blue}{X \sim Normal \; (\mu,\sigma^2)}$`

## Footnotes

Here's a simple footnote,[^1] and here's a longer one.[^bignote]

[^1]: This is the first footnote.

[^bignote]: Here's one with multiple paragraphs and code.

## Anchor links

[Link to bullet list section](#bullet-list)

## Formatting

### Strikethrough 

~~The world is flat.~~ We now know that the world is round.

### Bold

This is *italic* text. So is this **bold** text.

### Task List

- [x] Write the press release
- [ ] Update the website
- [ ] Contact the media

### Emoji shortcodes

Gone camping! :tent: Be back soon.

That is so funny! :joy:

### Subscript and Superscript

X^2^

### Delimiter

based upon a -

---

based upon a *

***

### Quotes

> This is a single line blockequote sdfjsdlfkjasldkfjsdölfkjsdlfkjsadlöfkjsdlöfkjsadölfkjsdlf kjsldfkjsdalkjslkdfjlöskdfjlösdkjfsldkfjsöldkfjlösdkfjalsd  kfjlsdkfjlödkfjlaksdfjlkjdfslkjalsdkfjlasdkfj alsdkjflskdfj sdfklj 

> This is a multi line blockequote sdfjsdlfkjasldkfjsdölfkjsdlfkjsadlöfkjsdlöfkjsadölfkjsdlf kjsldfkjsdalkjslkdfjlöskdfjlösdkjfsldkfjsöldkfjlösdkfjalsd  kfjlsdkfjlödkfjlaksdfjlkjdfslkjalsdkfjlasdkfj alsdkjflskdfj sdfklj 
> This is a multi line blockequote sdfjsdlfkjasldkfjsdölfkjsdlfkjsadlöfkjsdlöfkjsadölfkjsdlf kjsldfkjsdalkjslkdfjlöskdfjlösdkjfsldkfjsöldkfjlösdkfjalsd  kfjlsdkfjlödkfjlaksdfjlkjdfslkjalsdkfjlasdkfj alsdkjflskdfj sdfklj 
> This is a multi line blockequote sdfjsdlfkjasldkfjsdölfkjsdlfkjsadlöfkjsdlöfkjsadölfkjsdlf kjsldfkjsdalkjslkdfjlöskdfjlösdkjfsldkfjsöldkfjlösdkfjalsd  kfjlsdkfjlödkfjlaksdfjlkjdfslkjalsdkfjlasdkfj alsdkjflskdfj sdfklj 