const fs = require("fs");
const path = require("path");
const base = "C:\\Users\\senny\\Desktop\\KILIVANA\\kilivana\\src\\app";

const files = {};

files["features/auth/login/login.ts"] = Buffer.from(
  "aW1wb3J0IHsgQ29tcG9uZW50LCBpbmplY3QsIHNpZ25hbCwgY29tcHV0ZWQgfSBmcm9tIEBhbmd1bGFyL2NvcmU7" +
  "CmltcG9ydCB7IFJvdXRlciwgUm91dGVyTGluayB9IGZyb20gIkBhbmd1bGFyL3JvdXRlciI7" +
  "CmltcG9ydCB7IEF1dGggfSBmcm9tICIuL2NvcmUvc2VydmljZXMvYXV0aCI7" +
  "CmltcG9ydCB7IHVzZXIsIHNpZ25hbCB9IGZyb20gIkBhbmd1bGFyL2NvcmUiOw==",
  "base64"
).toString("utf-8");

for (const [rel, content] of Object.entries(files)) {
  fs.writeFileSync(path.join(base, rel), content, "utf-8");
  console.log("wrote", rel);
}