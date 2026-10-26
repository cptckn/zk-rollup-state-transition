use ark_bn254::Fr;
use ark_ff::{PrimeField, Zero};
use light_poseidon::{Poseidon, PoseidonHasher};

const DEPTH: usize = 8;

fn poseidon(inputs: &[Fr]) -> Fr {
    // new_circom uses the same constants and parameters as circomlib
    let mut h = Poseidon::<Fr>::new_circom(inputs.len()).unwrap();
    h.hash(inputs).unwrap()
}

fn main() {
    // Known test vector: circomlib Poseidon([1, 2])
    let tv = poseidon(&[Fr::from(1u64), Fr::from(2u64)]);
    println!("Poseidon(1,2) = {}", tv.into_bigint());
    assert_eq!(
        tv.into_bigint().to_string(),
        "7853200120776062878684798364095072458815029376092732009249414926327459813530"
    );

    // 256 leaves: the first few contain account data; the rest are zero
    let n = 1usize << DEPTH;
    let mut leaves = vec![Fr::zero(); n];
    let accounts: Vec<(u64, u64, u64)> = vec![(111, 1000, 0), (222, 500, 3), (333, 42, 7)];
    for (i, (pk, bal, nonce)) in accounts.iter().enumerate() {
        leaves[i] = poseidon(&[Fr::from(*pk), Fr::from(*bal), Fr::from(*nonce)]);
    }

    // Compute all Merkle tree levels
    let mut layers: Vec<Vec<Fr>> = vec![leaves];
    for _ in 0..DEPTH {
        let prev = layers.last().unwrap();
        let next: Vec<Fr> = prev.chunks(2).map(|c| poseidon(&[c[0], c[1]])).collect();
        layers.push(next);
    }
    let root = layers[DEPTH][0];

    // Account whose Merkle inclusion is to be proven: index 1 -> (222, 500, 3)
    let idx = 1usize;
    let (pk, bal, nonce) = accounts[idx];
    let mut path_elements = vec![];
    let mut path_indices = vec![];
    let mut cur = idx;
    for level in 0..DEPTH {
        let sibling = cur ^ 1;
        path_elements.push(layers[level][sibling]);
        path_indices.push(cur & 1); // 0: current node is the left child; 1: current node is the right child
        cur >>= 1;
    }

    let s = |f: &Fr| format!("\"{}\"", f.into_bigint());
    let pe: Vec<String> = path_elements.iter().map(s).collect();
    let pi: Vec<String> = path_indices.iter().map(|b| format!("\"{}\"", b)).collect();
    println!(
        "{{\n  \"root\": {},\n  \"pubkeyHash\": \"{}\",\n  \"balance\": \"{}\",\n  \"nonce\": \"{}\",\n  \"pathElements\": [{}],\n  \"pathIndices\": [{}]\n}}",
        s(&root), pk, bal, nonce, pe.join(", "), pi.join(", ")
    );
}
