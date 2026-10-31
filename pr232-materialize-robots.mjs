import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
writeFileSync("robots.txt", execFileSync("git", ["show", "HEAD:robots.txt"]));