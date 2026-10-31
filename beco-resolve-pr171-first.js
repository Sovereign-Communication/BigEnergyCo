const fs=require("node:fs");
const p="assets/js/sizing/ui.js"; let s=fs.readFileSync(p,"utf8");
const lines=s.split(/\r?\n/); const i=lines.indexOf("<<<<<<< HEAD");
if(i<0) throw new Error("ui import conflict marker missing");
const expected=['<<<<<<< HEAD','} from "../shared/cut-targets.js?v=20261022j";','=======','} from "../shared/cut-targets.js?v=20261005h";','import { interpolateCurveTarget } from "./frontier.js?v=20261005h";'];
for(let n=0;n<expected.length;n++) if(lines[i+n]!==expected[n]) throw new Error("unexpected conflict line "+n);
if(!lines[i+5].startsWith(">>>>>>> b9d2986c")) throw new Error("unexpected conflict terminator");
lines.splice(i,6,'} from "../shared/cut-targets.js?v=20261022j";','import { interpolateCurveTarget } from "./frontier.js?v=20261022j";');
const eol=s.includes("\r\n")?"\r\n":"\n"; fs.writeFileSync(p,lines.join(eol));
