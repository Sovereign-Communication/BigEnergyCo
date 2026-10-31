import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
const { LOCALES } = await import(pathToFileURL('C:/tmp/beco-i18n-noop-20261022/assets/js/shared/locales.js'));
const x=JSON.parse(fs.readFileSync('C:/tmp/jev-main-2054/experience-report.json','utf8')).experience_reading;
const seen=new Set();
for(const l of x.locales){for(const s of l.surfaces||[]){if(!s.visible)continue;const key=`${l.locale}:${s.key}`;if(seen.has(key))continue;seen.add(key);console.log(`${l.locale}\t${s.key}\t${JSON.stringify(s.text)}\tEN=${JSON.stringify(LOCALES.en[s.key])}`)}}
console.log('unique visible locale/key surfaces',seen.size);
