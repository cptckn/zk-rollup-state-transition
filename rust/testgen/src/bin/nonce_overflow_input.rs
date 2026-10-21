use std::fs;
use std::path::PathBuf;

use ark_bn254::Fr;
use ark_ff::{PrimeField, Zero};
use light_poseidon::{Poseidon, PoseidonHasher};

const DEPTH: usize = 8;
const ACCOUNT_IDX: usize = 1;
const PK: u64 = 222;
const OLD_BALANCE: u64 = 500;
const OLD_NONCE: u64 = 4294967295;
const AMOUNT: u64 = 100;

fn poseidon(inputs: &[Fr]) -> Fr {
    let mut hasher = Poseidon::<Fr>::new_circom(inputs.len()).unwrap();
    hasher.hash(inputs).unwrap()
}

fn tree_layers(leaves: Vec<Fr>) -> Vec<Vec<Fr>> {
    assert_eq!(leaves.len(), 1usize << DEPTH);
    let mut layers = vec![leaves];
    for _ in 0..DEPTH {
        let previous = layers.last().unwrap();
        let next: Vec<Fr> = previous
            .chunks_exact(2)
            .map(|pair| poseidon(&[pair[0], pair[1]]))
            .collect();
        layers.push(next);
    }
    layers
}

fn merkle_root_from_path(leaf: Fr, path: &[Fr], indices: &[usize]) -> Fr {
    let mut h = leaf;
    for (sibling, bit) in path.iter().zip(indices.iter()) {
        h = if *bit == 0 {
            poseidon(&[h, *sibling])
        } else {
            assert_eq!(*bit, 1);
            poseidon(&[*sibling, h])
        };
    }
    h
}

fn account_leaf(balance: Fr, nonce: u64) -> Fr {
    poseidon(&[Fr::from(PK), balance, Fr::from(nonce)])
}

fn decimal(value: Fr) -> String {
    value.into_bigint().to_string()
}

struct TestCase<'a> {
    old_root: Fr,
    new_root: Fr,
    amount: u64,
    new_balance: Fr,
    new_nonce: u64,
    path_elements: &'a [Fr],
    path_indices: &'a [usize],
}

fn write_case(directory: &PathBuf, name: &str, case: &TestCase<'_>) {
    let elements = case
        .path_elements
        .iter()
        .map(|x| format!("\"{}\"", decimal(*x)))
        .collect::<Vec<_>>()
        .join(", ");
    let indices = case
        .path_indices
        .iter()
        .map(|x| format!("\"{x}\""))
        .collect::<Vec<_>>()
        .join(", ");
    let json = format!(
        concat!(
            "{{\n",
            "  \"oldRoot\": \"{}\",\n",
            "  \"newRoot\": \"{}\",\n",
            "  \"amount\": \"{}\",\n",
            "  \"pubkeyHash\": \"{}\",\n",
            "  \"oldBalance\": \"{}\",\n",
            "  \"newBalance\": \"{}\",\n",
            "  \"oldNonce\": \"{}\",\n",
            "  \"newNonce\": \"{}\",\n",
            "  \"pathElements\": [{}],\n",
            "  \"pathIndices\": [{}]\n",
            "}}\n"
        ),
        decimal(case.old_root),
        decimal(case.new_root),
        case.amount,
        PK,
        OLD_BALANCE,
        decimal(case.new_balance),
        OLD_NONCE,
        case.new_nonce,
        elements,
        indices
    );
    fs::write(directory.join(format!("{name}.json")), json)
        .expect("unable to write test input");
    println!("Generated {name}.json");
}

fn main() {
    let mut leaves = vec![Fr::zero(); 1usize << DEPTH];
    leaves[0] = poseidon(&[Fr::from(111u64), Fr::from(1000u64), Fr::zero()]);
    leaves[1] = account_leaf(Fr::from(OLD_BALANCE), OLD_NONCE);
    leaves[2] = poseidon(&[Fr::from(333u64), Fr::from(42u64), Fr::from(7u64)]);

    let old_layers = tree_layers(leaves.clone());
    let old_root = old_layers[DEPTH][0];

    let mut index = ACCOUNT_IDX;
    let mut siblings = Vec::new();
    let mut indices = Vec::new();
    for layer in old_layers.iter().take(DEPTH) {
        siblings.push(layer[index ^ 1]);
        indices.push(index & 1);
        index >>= 1;
    }
    assert_eq!(
        old_root,
        merkle_root_from_path(leaves[ACCOUNT_IDX], &siblings, &indices)
    );

    let new_balance = Fr::from(OLD_BALANCE - AMOUNT);
    let new_nonce = OLD_NONCE + 1;
    let new_leaf = account_leaf(new_balance, new_nonce);
    let new_root = merkle_root_from_path(new_leaf, &siblings, &indices);

    // Independently rebuild the complete updated tree as a cross-check.
    leaves[ACCOUNT_IDX] = new_leaf;
    assert_eq!(tree_layers(leaves)[DEPTH][0], new_root);

    let outputs = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("../../tests/mutations/nonce_overflow");
    fs::create_dir_all(&outputs).unwrap();
    let counterexample = TestCase {
        old_root,
        new_root,
        amount: AMOUNT,
        new_balance,
        new_nonce,
        path_elements: &siblings,
        path_indices: &indices,
      write_case(&outputs, "nonce_overflow_counterexample", &counterexample);

d);

    println!("Old root: {}", decimal(old_root));
    println!("New root: {}", decimal(new_root));
}
