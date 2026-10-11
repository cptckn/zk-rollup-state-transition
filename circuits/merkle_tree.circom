pragma circom 2.1.0;

// Original account-inclusion circuit, now using shared templates.
include "./merkle_components.circom";

template AccountInclusion(depth) {
    signal input root;
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
