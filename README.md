## kindle dictionary generator

An script to get the translation for every word in a given epub document and build it into a single dictionary.  
It will connect to `http://app.vocabulary.com/app/1.0/dictionary/search?word=WORD` for each word.  

### How to use

- Run the following
This will generate to two files `book.html` and `book.opf`.  
The html file contains all the translations, the opf file is the manifest.  

```
node index.js book.epub
```

- Install `kindegen`

```
brew cask install kindlegen
```

- Use kindlegen to generate the kindle compatible dictionary

```
kindlegen book.opf
```

- Upload the book to your kindle `/documents/dictionary/`
- Go to Settings -> Language & Dictionary -> English -> book
- Done ;-)
