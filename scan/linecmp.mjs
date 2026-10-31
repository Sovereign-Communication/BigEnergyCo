// Compare the brand domain's line-level hashes (captured in a real browser)
// against the committed blob's, to locate exactly what the edge injects.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";

const BRAND = `c77e5168dffd,876b0aade9c7,ce519cccc38c,d0179bca1018,d2a257373e9d,8c65dd4a1900,6bcca54412f8,ce4da54d2096,478127cda1ff,b0c81591c09b,b97ae466110b,27d42feff043,4983d2a93ba4,e72bb3c366a7,a980ac9798b6,3abae20c3937,387a07d6407b,b6d83232fe16,77085a636e50,5874e6d5a0a4,762df1529dc2,06e917d5f584,e3a194e11b02,4718883e124d,c8060da562fb,3eb02b98c81c,f856ed77aac6,52b92ca8220b,59c98acc8b7c,a9030368b4b9,809af0c1444c,53718c377ed3,e3177da68fdc,9e898918242e,3c1e93fd139f,aea982aebb09,6baae6daf909,37562ff6456e,d8329f1a2d06,96f1b1ddbaa2,7ae68ed59f0c,9e898918242e,8a9ff88ea722,a64a7dc89742,354f76a7d56d,012d1bf5c4f2,33ec1300fca3,ca0b788a04ec,f61f5bbc379f,9556700e74a6,737db166c79a,a9bc5143b485,8a59938f145d,70b917e85e0a,34e2520603c9,2918c762bf0b,d37bf6671d72,865930ed045d,cd3da04b73d4,c5364031fc3b,1b973df70f9b,d91b91d99e45,c80c19c93122,652d27e17816,28d86778615f,b93cf561d89d,69cb9cc05d77,f1c0668d11b9,28a7ab917624,fc88dcac541a,5044565bd20c,a0a4faa4150a,f4e92f9fc9c8,3cc13c318807,98d6848f0849,3e4b6acab2b9,01190a1e6489,28d86778615f,cc4c51a75bc1,9c5379485902,fef9f831391a,1e8c3c7264ee,92407a5a6eaa,6db43ea3ccb6,25f7bc16a71b,ff8e20ca9efa,3b0c52bbb69f,5dc69c30bcf7,c1a6a96aaff5,307e954c93f0,28d86778615f,a4e6349a933a,7efbb646de97,9468dd0e94c2,dee536365561,2d8aad570b11,8a0a572a135c,6c03eea08f91,9927a20f1219,1806d3a451f9,54daa85d50ed,8f2ed7fd935f,eb9bdfc1e3ab,0f9014dc2cc2,9ef2d167b135,e3c0117a5964,bb17cbc52fe9,85578052560a,734d1bb2ba61,5470bcc7d1f9,2b3e8fd90a76,67115d8b750c,f99929bacbcb,71fa4931951c,92407a5a6eaa,6db43ea3ccb6,ce2b29772a46,29b43eba6291,061efc168683,625445a920bb,28d86778615f,770fe57cf0b5,440b44535a4b,fdd17d9b2ff8,cc7584f4d130,d96a7ed9ee7c,28d86778615f,5eacbe940679,69eb3111ab65,9aabfd165cfb,4648c2224ff3,d837ae04cbe8,67970711ec9d,5797c88f7734,1094fa49bf3f,625b62c6faee,d01e0ffa9e97,4ccd225c88ad,ce32fcb9ea8b,c6a832580802,aa2c70b5748a,1a7f8973cae1,fd81eceb849f,8f2b5e123377,db5e255cac9c,e80c476b98f4,d0e339c0d126,7dc8d37d8f9f,566c311861ea,e3b0c44298fc,5c4bb9e32e0b,83929b902a8d,401afa63b42e,c5a7a55283de,86ace1091cb8,57fd4bc0f86b,1d45e9be3a0d,b44d361291b8,04044056c302,b18d12667bd4,9c370fbe57d1,9ec38916c6f9,d0e339c0d126,e3b0c44298fc,b5a9ee4dcb37,ed5f18871f54,7c90fddfeb55,f7e7316dd08c,1c34eeb3daa1,45a85cc6ef68,1c9dc313a3a8,3ab79dcab959,386d6d9680f3,221e0d25d416,2ab6e368a118,214d8d9405ac,35a3e8a6c069,d0e339c0d126,072118af54db,f7e7316dd08c,da56076bb95e,151e8cf94d7a,6f7a46c6433d,757d27a29cb3,d0e339c0d126,0afa7660d160,f7e7316dd08c,bea700e9d022,e8205b23dc3e,d0e339c0d126,3a0426ee4923,f7e7316dd08c,0c3132f312bc,96101aa96d2b,4fec68def4d5,c8a5de4fb743,921a0c70bf89,80ecb9ddcc95,c33213e7b2dd,14d787881024,d0e339c0d126,66776fa61af7,f7e7316dd08c,aebac404a611,c1792a75ab21,2c8f7dfc9b61,1d9b0e068a24,b8fdfd8304fc,1396f9cf0d46,54baafdbc5a1,f8b8c0b2fc0a,d0e339c0d126,83fdebf04838,f7e7316dd08c,cf03fe005ad2,d0e339c0d126,15f2a58e4e0e,f7e7316dd08c,c150c58e8039,71169a09b90d,f282e85634ae,d37c5e4f1246,19be5c21294b,e11ef52afb75,19a418187fd5,3c8c5d4a8a2c,4b5b1ce7135d,f122e256ca92,d0e339c0d126,c93a79f17af4,f7e7316dd08c,2a129cb789ce,c195a96fb12d,d0e339c0d126,af5cebb0d276,f7e7316dd08c,5a8b2f56a9e9,f9b710c5eb1c,a8d8aecb280d,24030dcfd5ee,132c539c0ad6,1300d3d30747,d0e339c0d126,583b92275f7d,f7e7316dd08c,f5908892f5ce,afdf531dc5d7,ee8c40c902da,7b6a2540ca31,94cde2798416,eb21d1160692,d0e339c0d126,1be7a5c16997,f7e7316dd08c,6f676415f3f5,ed80a679a8cb,184cc07181e0,73d58c038b05,3b2f2424f137,d0e339c0d126,69d68540baae,f7e7316dd08c,f792aedf25aa,37c674c7ba38,903b3b9d8f3d,887c481f1fc2,2399b53a76cc,d0e339c0d126,4adad064fe85,2cb10b5f166b,c85f646a818d,5ac5d16e087b,186065a5e873,2a29f9f2ec47,7980f5d48ca2,33b14753cb3c,e3b0c44298fc,5a053545bc93,67970711ec9d,ea4c4e543596,bfd9a55d0a52,648d1337ee70,71ad9d1bcdf3,7dc8d37d8f9f,f1503fc8e994,f483f4723137,fdfe0993e6e9,e3b0c44298fc`.split(",");

const local = execFileSync(
  "git",
  ["show", "HEAD:solar-calculator/index.html"],
  { cwd: "C:/tmp/gate-freshness", maxBuffer: 64 * 1024 * 1024 },
)
  .toString("utf8")
  .split("\n")
  .map((l) => createHash("sha256").update(l).digest("hex").slice(0, 12));

console.log("brand lines:", BRAND.length, "local lines:", local.length);
const brandSet = new Set(BRAND);
const localSet = new Set(local);
const brandOnly = BRAND.map((h, i) => [h, i]).filter(([h]) => !localSet.has(h));
const localOnly = local.map((h, i) => [h, i]).filter(([h]) => !brandSet.has(h));
console.log("\nbrand-only lines (injected or changed):");
for (const [h, i] of brandOnly) console.log(`  brand[${i}] ${h}`);
console.log("\nlocal-only lines (removed or changed):");
for (const [h, i] of localOnly) {
  const text = execFileSync(
    "git",
    ["show", "HEAD:solar-calculator/index.html"],
    { cwd: "C:/tmp/gate-freshness", maxBuffer: 64 * 1024 * 1024 },
  )
    .toString("utf8")
    .split("\n")[i];
  console.log(`  local[${i}] ${h} :: ${JSON.stringify(text.slice(0, 90))}`);
}
