
import {JSDOM} from "jsdom";
import { globSync } from "glob";
import * as fs from 'fs';
import * as path from 'path';
import {html2xmlstr} from "./conv.js";

function convert(file) {
    try {
        let dom= new JSDOM();
        console.log(file)
        let data = fs.readFileSync(file, 'utf8')
        let xml = html2xmlstr(data, dom.window)
        if (xml) {
            fs.writeFileSync(file + ".xml", xml)
        }
    } catch (e) {

    }
}

for (let i = 2; i < process.argv.length; i++) {
    let p = process.argv[i]
    if (fs.lstatSync(p).isDirectory()) {
        let files = globSync(path.join(p, '**/*.html'))
        files.forEach(file => convert(file))
    } else {
        convert(p)
    }
}

