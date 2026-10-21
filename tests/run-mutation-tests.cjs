// Differential regression tests: a malicious witness must be rejected by the
// original circuit but accepted by the intentionally weakened mutant.
// Acceptance is confirmed by snarkjs wtns check, not merely a successful
// witness calculation. This is NOT a proof of circuit soundness.
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const build = path.join(root, 'build');
const cli = path.join(root, 'node_modules', 'snarkjs', 'build', 'cli.cjs');
const originalWasm = path.join(build, 'state_transition_js', 'state_transition.wasm');
const mutationCases = [
  {
    name: 'balance range / modular underflow',
    input: 'tests/inputs/state_transition_invalid_underflow.json',
    mutant: 'no_range',
    circuit: 'state_transition_no_range',
  },
  {
    name: 'nonce range / 32-bit overflow',
    input: 'tests/mutations/nonce_overflow/nonce_overflow_counterexample.json',
    mutant: 'no_nonce_range',
    circuit: 'state_transition_no_nonce_range',
  },
  {
    name: 'new Merkle root binding',
    input: 'tests/inputs/state_transition_invalid_new_root.json',
    mutant: 'no_new_root_check',
    circuit: 'state_transition_no_new_root_check',
  },
];

function snarkjs(args) {
  return spawnSync(process.execPath, [cli, ...args], {
    cwd: root, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024,
  });
}
function output(r) {
  return `${r.error || ''}\n${r.stdout || ''}\n${r.stderr || ''}`;
}
function requireFile(file) {
  if (!fs.existsSync(file)) throw new Error(`Missing file: ${file}\nRun 'npm run build:circom' first.`);
}
function runTest(c) {
  const input = path.join(root, c.input);
  const mutationDir = path.join(build, 'mutations', c.mutant);
  const mutantWasm = path.join(mutationDir, `${c.circuit}_js`, `${c.circuit}.wasm`);
  const mutantR1cs = path.join(mutationDir, `${c.circuit}.r1cs`);
  const originalR1cs = path.join(build, 'state_transition.r1cs');
  for (const file of [cli, input, originalWasm, originalR1cs, mutantWasm, mutantR1cs]) requireFile(file);

  // Baseline rejects the same input used for the mutant: this is essential.
  const baselineWitness = path.join(mutationDir, 'baseline_rejected.wtns');
  const baseline = snarkjs(['wtns', 'calculate', originalWasm, input, baselineWitness]);
  if (baseline.error || baseline.status === null || baseline.status === 0 ||
      !/Assert Failed/i.test(output(baseline))) {
    throw new Error(`Original circuit did not reject ${c.name} as expected:\n${output(baseline)}`);
  }

  const mutantWitness = path.join(mutationDir, 'accepted.wtns');
  const mutant = snarkjs(['wtns', 'calculate', mutantWasm, input, mutantWitness]);
  if (mutant.error || mutant.status !== 0) {
    throw new Error(`Mutant did not calculate a witness for ${c.name}:\n${output(mutant)}`);
  }
  const check = snarkjs(['wtns', 'check', mutantR1cs, mutantWitness]);
  if (check.error || check.status !== 0 || !/WITNESS IS CORRECT/i.test(output(check))) {
    throw new Error(`Mutant witness failed R1CS verification for ${c.name}:\n${output(check)}`);
  }
  console.log(`PASS ${c.name}: original rejects, mutant accepts with valid R1CS witness`);
}

try {
  let passed = 0;
  for (const c of mutationCases) {
    runTest(c);
    passed++;
  }
  console.log(`\n${passed}/${mutationCases.length} mutation experiments passed`);
} catch (e) {
  console.error(`FAIL ${e.message}`);
  process.exitCode = 1;
}
