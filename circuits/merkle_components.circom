pragma circom 2.1.0;

// Shared templates for membership proofs and account state transitions.
// This file deliberately has NO component main.
include "circomlib/circuits/poseidon.circom";
include "circomlib/circuits/mux1.circom";

template AccountLeaf() {
    signal input pubkeyHash;
    signal input balance;
    signal input nonce;
    signal output leaf;

    component h = Poseidon(3);
    h.inputs[0] <== pubkeyHash;
    h.inputs[1] <== balance;
    h.inputs[2] <== nonce;
    leaf <== h.out;
}

template MerkleTreeInclusionProof(depth) {
    signal input leaf;
    signal input pathElements[depth];
    signal input pathIndices[depth];
    signal output root;

    component mux[depth];
    component hashers[depth];
    signal levelHashes[depth + 1];
    levelHashes[0] <== leaf;

    for (var i = 0; i < depth; i++) {
        // Ensure selectors are field elements 0 or 1.
        pathIndices[i] * (1 - pathIndices[i]) === 0;

        mux[i] = MultiMux1(2);
        mux[i].c[0][0] <== levelHashes[i];
        mux[i].c[0][1] <== pathElements[i];
        mux[i].c[1][0] <== pathElements[i];
        mux[i].c[1][1] <== levelHashes[i];
        mux[i].s <== pathIndices[i];

        hashers[i] = Poseidon(2);
        hashers[i].inputs[0] <== mux[i].out[0];
        hashers[i].inputs[1] <== mux[i].out[1];
        levelHashes[i + 1] <== hashers[i].out;
    }

    root <== levelHashes[depth];
}
