
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const root = path.resolve(__dirname, "..");
const build = path.join(root, "build");
const inputs = path.join(root, "tests", "inputs");
const cli = path.join(root, "node_modules", "snarkjs", "build", "cli.cjs");
const wasm = path.join(build, "merkle_tree_js", "merkle_tree.wasm");
const r1cs = path.join(build, "merkle_tree.r1cs");

for (const file of [cli, wasm, r1cs]) {
    if (!fs.existsSync(file)) {
        console.error("Missing file:", file);
        process.exit(1);
    }
}

function run(args) {
    return spawnSync(process.execPath, [cli, ...args], {
        cwd: root,
        encoding: "utf8"
    });
}

let passed = 0;

function report(name, success, result) {
    console.log(`${success ? "PASS" : "FAIL"} - ${name}`);
    if (success) passed++;
    else if (result) {
        console.error(result.stdout, result.stderr);
    }
}

// Positive test: valid membership
const validWitness = path.join(build, "valid.wtns");
const validCalc = run([
    "wtns", "calculate", wasm,
    path.join(inputs, "account_inclusion_valid.json"),
    validWitness
]);

const validCheck = validCalc.status === 0
    ? run(["wtns", "check", r1cs, validWitness])
    : null;

report(
    "Valid membership",
    validCheck?.status === 0 &&
    /WITNESS IS CORRECT/.test(validCheck.stdout),
    validCheck || validCalc
);

// Negative tests: witness calculation must fail on constraints
for (const name of ["invalid_root", "invalid_path", "invalid_index"]) {
    const result = run([
        "wtns", "calculate", wasm,
        path.join(inputs, `account_inclusion_${name}.json`),
        path.join(build, `${name}.wtns`)
    ]);

    const rejected = result.status !== null &&
        result.status !== 0 &&
        /Assert Failed/i.test(result.stdout + result.stderr);

    report(name, rejected, result);
}

console.log(`\n${passed}/4 tests passed`);
if (passed !== 4) process.exitCode = 1;
