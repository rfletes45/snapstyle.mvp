const fs = require("fs");
const path = require("path");
const dir = path.resolve(__dirname, "courses");
const files = fs.readdirSync(dir).filter((f) => /^H\d{2}\.json$/i.test(f));
let fixed = 0;
for (const f of files) {
  const fp = path.join(dir, f);
  let txt = fs.readFileSync(fp, "utf-8");
  const orig = txt;
  // Replace "size": { "x": N, "y": M } with "size": { "width": N, "height": M }
  txt = txt.replace(
    /"size":\s*\{\s*"x":\s*(\d+),\s*"y":\s*(\d+)\s*\}/g,
    (_, w, h) => `"size": { "width": ${w}, "height": ${h} }`,
  );
  if (txt !== orig) {
    fs.writeFileSync(fp, txt);
    fixed++;
    console.log("Fixed:", f);
  }
}
console.log("Total fixed:", fixed);
