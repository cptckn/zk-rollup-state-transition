// Compile the baseline and all three deliberately weakened circuits.
// No proving setup or generated artifacts are committed to source control.
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const build = path.join(root, 'build');
const circuits = [
  ['merkle_tree.circom', build],
  ['state_transition.circom', build],
  ['state_transition_no_range.circom', path.join(build, 'mutations', 'no_range')],
  ['state_transition_no_nonce_range.circom', path.join(build, 'mutations', 'no_nonce_range')],
  ['state_transition_no_new_root_check.circom', path.join(build, 'mutations', 'no_new_root_check')],
];

for (const [file, target] of circuits) {
  fs.mkdirSync(target, { recursive: true });
  process.stdout.write(`Compiling ${file} ...\n`);
  const run = spawnSync('circom', [
    path.join(root, 'circuits', file), '--r1cs', '--wasm',
    '-l', path.join(root, 'node_modules'), '-o', target,
  ], { cwd: root, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 });
  if (run.error || run.status !== 0) {
    console.error(run.error || run.stderr || run.stdout);
    process.exit(1);
  }
  console.log('OK');
}
console.log('5 circuits compiled successfully.');
