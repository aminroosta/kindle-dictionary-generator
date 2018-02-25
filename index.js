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
const progress = require('progress');

const REQUEST_WORKERS = 8;
const dictionary = { };

program
	.version(version)
	.usage('[options] <path>')
	.arguments('<path>')
	.option("-i, --image-root [image_root]", "specify the prefix for image URL's.", '/images/')
	.option("-c, --chapter-root [chapter_root]", "specify the prefix for chapter URL's.", '/links/')
	.parse(process.argv);

async function request(array, bar) {
    for(const word of array) {
		if(dictionary[word]) {
			bar.tick({token1: word.green});
			continue;
		}
        try {
            const thtml = await axios.get(`http://app.vocabulary.com/app/1.0/dictionary/search?word=${word}`)
            const $t = cheerio.load(thtml.data);
            dictionary[word] = {
                short: $t('.main .short').text(),
                long : $t('.main .long').text()
            };
            bar.tick({token1: word.blue});
        } catch(e) {
            dictionary[word] = { short: '', long : '' };
            bar.tick({token1: word.red});
        }
    }
}

function chunkify(arr, n) {
    if (n < 2)
        return [arr];

    const len = arr.length;
    const out = [];

    let i = 0;
    let size;
    while (i < len) {
        size = Math.ceil((len - i) / n--);
        out.push(arr.slice(i, i += size));
    }

    return out;
}

async function parse_html(html) {
    const $ = cheerio.load(html)
    const text = $.text();
    const words = text.split(/\s+/)
        .filter(w => (
				(!w) || (w.indexOf("’") === -1)
            )
        )
        .map(w => w.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g,' '))
        .map(w => w.toLowerCase().trim())
        .filter(w => w.length >= 3 && /^[A-Za-z]+$/.test(w));

    const uwords = Array.from(new Set(words))
    console.log(`translating ${uwords.length} words ...`.blue);
     var bar = new progress('  downloading [:bar] :current/:total (:percent) :rate/wps :etas :token1'.green, {
        complete: '=',
        incomplete: ' ',
        width: 50,
        total: uwords.length
    });

    await Promise.all(
        chunkify(uwords, REQUEST_WORKERS).map(arr => request(arr, bar))
    );
}


async function read_chapters(file) {
    const chapter_keys = Object.keys(file.manifest);

    const getChapter = util.promisify(file.getChapter.bind(file));
    for(const key of chapter_keys) {
        try {
            const text = await getChapter(key);
            console.log(`processing chapter: ${key} ...`.blue);
            await parse_html(text);
        } catch(e) {
			console.error(e.message.red);
		}
    }
}

function write_opf(fileName) {
	const entries = [];
	Object.keys(dictionary).map(word => {
		const {short, long} = dictionary[word];
		if(short) entries.push(
		`<idx:entry>
			<b><idx:orth>${word}
			</idx:orth> </b> 
			<br/>
			${short}
			<br/>
			${long}
		</idx:entry>`
		);
	});

	const html = `
	<?xml version="1.0" encoding="utf-8"?>
	<html
		xmlns:idx="www.mobipocket.com"
		xmlns:mbp="www.mobipocket.com"
		xmlns:xlink="http://www.w3.org/1999/xlink">
	<body>

	${entries.join('\n<hr/>\n\n')}

	</body>
	</html>`;

	
	const opf = `
	<?xml version="1.0"?><!DOCTYPE package SYSTEM "oeb1.ent">
	<package unique-identifier="uid" xmlns:dc="Dublin Core">
		<metadata>
			<dc-metadata>
				<dc:Identifier id="uid">${fileName}</dc:Identifier>
				<dc:Title><h2>${fileName}</h2></dc:Title>
				<dc:Language>EN</dc:Language>
			</dc-metadata>
			<x-metadata>
					<output encoding="utf-8" flatten-dynamic-dir="yes"/>
				<DictionaryInLanguage>en</DictionaryInLanguage>
				<DictionaryOutLanguage>en</DictionaryOutLanguage>
			</x-metadata>
		</metadata>

		<manifest>
			 <item id="dictionary0" href="${fileName}.html" media-type="text/x-oeb1-document"/>
		</manifest>
		<spine>
			<itemref idref="dictionary0"/>
		</spine>
	</package>
	`;

	fs.writeFileSync(`${fileName}.html`, html, 'utf8');
	fs.writeFileSync(`${fileName}.opf`, opf, 'utf8');
	console.log();
    console.log(`Wrote ${fileName}.opf & ${fileName}.html`.green);
    console.log(`Type the following command to get your dictionary:`.green);
    console.log(`kindlegen ${fileName}.opf`.blue);
}

function main() {


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

    file.on("end", async () => {
        await read_chapters(file);
		write_opf(filePath.split('.')[0]);
    });
}

main();
