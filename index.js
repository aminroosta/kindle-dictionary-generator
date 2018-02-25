#!/usr/bin/env node
const program = require('commander');
const colors  = require('colors');
const path    = require('path');
const fs      = require('fs');
const version = require('./package.json').version;
const epub = require('epub');
const util = require('util');
const cheerio = require('cheerio')
const axios = require('axios');
var progress = require('progress');


const dictionary = { };

function get_word(word) {
    axios.get('http://app.vocabulary.com/app/1.0/dictionary/search?word=Antonyms')
      .then(response => {
            console.log(response.data.url);
            console.log(response.data.explanation);
          })
      .catch(error => {
            console.log(error);
          });
}

async function parse_html(html) {
    const $ = cheerio.load(html)
    const text = $.text();
    const words = text.split(/\s+/)
        .filter(w => (
                (!w) || (w.indexOf("’") === -1)
            )
        )
        .map(w => w.replace('-', ' ').replace('.', ''))
        .filter(w => w.length >= 4)
        .map(w => w.toLowerCase());

    const uwords = Array.from(new Set(words))
                        .slice(0, 100);

    console.log(`translating ${uwords.length} words ...`.blue);
     var bar = new progress('  downloading [:bar] :current/:total (:percent) :rate/bps :etas :token1', {
        complete: '=',
        incomplete: ' ',
        total: uwords.length
    });
    for(const word of uwords) {
        try {
            const thtml = await axios.get(`http://app.vocabulary.com/app/1.0/dictionary/search?word=${word}`)
            const $t = cheerio.load(thtml.data);
            dictionary[word] = {
                short: $t('.main .short').text(),
                long : $t('.main .long').text()
            };
            bar.tick({ token1: word} );
        } catch(e) {
            console.log(e.message.red);
            bar.tick();
        }
    }

    // console.warn(JSON.stringify(words));
}


async function read_chapters(file) {
    const chapter_keys = Object.keys(file.manifest);

    const getChapter = util.promisify(file.getChapter.bind(file));
    for(const key of chapter_keys.slice(7,8)) {
        try {
            const text = await getChapter(key);
            console.log(`processing chapter: ${key} ...`.blue);
            parse_html(text);
        } catch(e) { }
    }
}

function main() {
    program
        .version(version)
        .usage('[options] <path>')
        .arguments('<path>')
        .option("-i, --image-root [image_root]", "specify the prefix for image URL's.", '/images/')
        .option("-c, --chapter-root [chapter_root]", "specify the prefix for chapter URL's.", '/links/')
        .parse(process.argv);


    const filePath = program.args[0];
    if(!fs.existsSync(filePath)) {
        console.log('error: file not found, see --help'.red);;
        return;
    } 
    if(!filePath.endsWith('.epub')) {
        console.log('error: not an epub file, see --help'.red);;
        return;
    }


    console.log(`parsing ${filePath} ...`.green);
    const file = new epub(filePath, program.imageRoot, program.chapterRoot);
    file.parse();

    file.on("end",() => {
        read_chapters(file);
    });
}

main();
