const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "specification.html"), "utf8");
const redirectIndex = html.indexOf('location.port !== "4173"');
const firstExternalScriptIndex = html.indexOf('src="https://');

assert(redirectIndex >= 0, "Specification must route local development to the Local AI gateway.");
assert(
  redirectIndex < firstExternalScriptIndex,
  "Local AI routing must run before Specification libraries and project data initialize."
);
assert(
  html.includes("location.pathname") &&
  html.includes("location.search") &&
  html.includes("location.hash"),
  "Local AI routing must preserve the current Specification URL."
);

const inlineScript = html.match(/<script>\s*([\s\S]*?)\s*<\/script>/)?.[1] || "";

function runRouting(location) {
  let redirectedTo = "";
  const context = {
    location: {
      ...location,
      replace(url) { redirectedTo = url; }
    }
  };
  vm.runInNewContext(inlineScript, context);
  return redirectedTo;
}

assert.strictEqual(
  runRouting({
    hostname: "127.0.0.1",
    port: "5500",
    pathname: "/specification.html",
    search: "?continue=1",
    hash: "#sources"
  }),
  "http://127.0.0.1:4173/specification.html?continue=1#sources"
);
assert.strictEqual(
  runRouting({
    hostname: "127.0.0.1",
    port: "4173",
    pathname: "/specification.html",
    search: "",
    hash: ""
  }),
  ""
);
assert.strictEqual(
  runRouting({
    hostname: "d3adgoose.github.io",
    port: "",
    pathname: "/NSAutomation/specification.html",
    search: "",
    hash: ""
  }),
  ""
);

console.log("Local AI same-origin routing checks passed.");
