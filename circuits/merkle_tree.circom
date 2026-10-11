pragma circom 2.1.0;

include "circomlib/circuits/poseidon.circom";
include "circomlib/circuits/mux1.circom";

// Hesap yaprağı: leaf = Poseidon(pubkeyHash, balance, nonce)
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

// Sabit derinlikli Merkle ağacında bir yaprağın root'a kadar olan yolunu hesaplar.
// pathIndices[i] = 0 -> o seviyede mevcut düğüm SOLDA, kardeş (pathElements[i]) SAĞDA
// pathIndices[i] = 1 -> o seviyede mevcut düğüm SAĞDA, kardeş SOLDA
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
        // pathIndices[i] ikili (0/1) olmak ZORUNDA; MultiMux1 bunu kendisi dayatmaz.
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

// Adım 1 ana devresi: (pubkeyHash, balance, nonce) hesabının, verilen root'lu
// ağaçta bulunduğunu kanıtlar.
template AccountInclusion(depth) {
    signal input root;                 // public
    signal input pubkeyHash;
    signal input balance;
    signal input nonce;
    signal input pathElements[depth];
    signal input pathIndices[depth];

    component leafHasher = AccountLeaf();
    leafHasher.pubkeyHash <== pubkeyHash;
    leafHasher.balance <== balance;
    leafHasher.nonce <== nonce;

    component proof = MerkleTreeInclusionProof(depth);
    proof.leaf <== leafHasher.leaf;
    for (var i = 0; i < depth; i++) {
        proof.pathElements[i] <== pathElements[i];
        proof.pathIndices[i] <== pathIndices[i];
    }

    root === proof.root;
}

component main {public [root]} = AccountInclusion(8);
