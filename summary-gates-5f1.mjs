import { readFileSync } from "node:fs";
const l=JSON.parse(readFileSync("C:/tmp/jev-main-5f1/lighthouse-report.json","utf8"));
const x=JSON.parse(readFileSync("C:/tmp/jev-main-5f1/experience-report.json","utf8"));
console.log("TARGETS",JSON.stringify({type:typeof l.targets,array:Array.isArray(l.targets),sample:Array.isArray(l.targets)?l.targets[0]:Object.entries(l.targets??{}).slice(0,3)},null,2));
console.log("MEASURED",JSON.stringify({type:typeof l.measured,array:Array.isArray(l.measured),sample:Array.isArray(l.measured)?l.measured[0]:Object.entries(l.measured??{}).slice(0,3)},null,2));
console.log("EXPERIENCE",JSON.stringify({experience_reading:x.experience_reading,facet_line:x.facet_line,facet_lines:x.facet_lines,regressions:x.regressions,holes:x.holes,notes:x.notes},null,2));