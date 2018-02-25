## kindle dictionary generator

This script gets the translation for every word in a given `.epub` document.  
Translations are queried from `http://app.vocabulary.com/app/1.0/dictionary/search?word=WORD`.  
It then builds it into a single dictionary in `.mobi` format.  

### How to use

- Run the following
This will generate two files `<book>.html` and `<book>.opf`.  
The `.html` file contains all the translations, the `opf` file is the manifest.  

```
node index.js book.epub
```

- Install `kindlegen`

```
brew cask install kindlegen
```

- Use `kindlegen` to generate the kindle compatible dictionary

```
kindlegen book.opf
```

- Upload the book to your kindle `/documents/dictionary/`
- Go to `Settings -> Language & Dictionary -> English -> <book>`

- Enjoy ;-)
