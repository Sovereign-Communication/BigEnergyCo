const fs=require("node:fs");
const r=JSON.parse(fs.readFileSync("C:/tmp/pr247-jev-report/jev-report.json","utf8"));
console.log("scope",r.scope,"score",r.score,"pass",r.pass,"scoped",r.scoped);
console.log("facetkeys",Object.keys(r.facets||{}));
for(const k of ["accessibility","performance","quality","testing"]) console.log(k,r.facets?.[k]);
console.log("required_work",r.required_work);
console.log("recommended_actions",r.recommended_actions);
console.log("blockers",r.blockers);