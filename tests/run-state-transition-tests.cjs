const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const repo = path.resolve(__dirname, "..");
const build = path.join(repo, "build");
const cli = path.join(repo, "node_modules", "snarkjs", "build", "cli.cjs");
const wasm = path.join(build, "state_transition_js", "state_transition.wasm");
const r1cs = path.join(build, "state_transition.r1cs");
const inputDir = path.join(__dirname, "inputs");

for (const filename of [cli, wasm, r1cs]) {
    if (!fs.existsSync(filename)) {
        console.error("Missing file:", filename);
        process.exit(1);
    }
}

function snarkjs(args) {
    return spawnSync(process.execPath, [cli, ...args], {
        cwd: repo,
        encoding: "utf8",
        maxBuffer: 8 * 1024 * 1024,
    });
}

const negativeCases = [
    "invalid_old_root",
    "invalid_new_root",
    "invalid_path",
    "invalid_index",
    "invalid_nonce",
    "invalid_underflow",
    "invalid_arithmetic",
];

let passed = 0;
function report(testName, ok, result) {
    console.log(`${ok ? "PASS" : "FAIL"} - ${testName}`);
    if (ok) passed++;
    else {
        if (result?.error) console.error(result.error);
        if (result?.stdout) console.error(result.stdout);
        if (result?.stderr) console.error(result.stderr);
    }
}

function calculate(name) {
    const json = path.join(inputDir, `state_transition_${name}.json`);
    if (!fs.existsSync(json)) {
        console.error("Missing test JSON:", json);
        process.exit(1);
    }
    return snarkjs([
        "wtns", "calculate", wasm, json,
        path.join(build, `state_transition_${name}.wtns`),
    ]);
}

const valid = calculate("valid");
const witnessCheck = valid.status === 0
    ? snarkjs(["wtns", "check", r1cs, path.join(build, "state_transition_valid.wtns")])
    : null;
report(
    "valid",
    witnessCheck?.status === 0 &&
        /WITNESS IS CORRECT/.test(witnessCheck.stdout + witnessCheck.stderr),
    witnessCheck ?? valid,
);

for (const name of negativeCases) {
    const result = calculate(name);
    // A negative case passes only if the witness calculator rejects a constraint.
    const rejected = result.status !== null && result.status !== 0 &&
        /Assert Failed/i.test((result.stdout || "") + (result.stderr || ""));
    report(name, rejected, result);
}

const total = 1 + negativeCases.length;
console.log(`\n${passed}/${total} tests passed`);
if (passed !== total) process.exitCode = 1;
