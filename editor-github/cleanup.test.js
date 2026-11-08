import test from 'node:test';
import assert from 'node:assert/strict';
import { shouldDeleteBranch } from './naming.js';

test('shouldDeleteBranch: ignores non-se branches', () => {
    assert.equal(shouldDeleteBranch({ name: 'main' }, { data: { files: [], ahead_by: 0 } }), false);
    assert.equal(shouldDeleteBranch({ name: 'feature/foo' }, { data: { files: [], ahead_by: 0 } }), false);
    assert.equal(shouldDeleteBranch(null, null), false);
});

test('shouldDeleteBranch: deletes empty or ahead_by == 0 branches', () => {
    const branch = { name: 'se-2026-11-08-test', associatedPullRequests: { edges: [] } };
    assert.equal(shouldDeleteBranch(branch, null), true);
    assert.equal(shouldDeleteBranch(branch, { data: { files: [] } }), true);
    assert.equal(shouldDeleteBranch(branch, { data: { files: ['some_file'], ahead_by: 0 } }), true);
});

test('shouldDeleteBranch: retains branches with unmerged changes and no PR', () => {
    const branch = { name: 'se-2026-11-08-test', associatedPullRequests: { edges: [] } };
    const diff = { data: { files: [{ filename: 'songs/pl/test.xml' }], ahead_by: 1 } };
    assert.equal(shouldDeleteBranch(branch, diff), false);
});

test('shouldDeleteBranch: deletes branches when all associated PRs are merged or closed', () => {
    const branchMerged = {
        name: 'se-2026-11-08-test',
        associatedPullRequests: {
            edges: [
                { node: { number: 123, closed: true, merged: true } }
            ]
        }
    };
    const diff = { data: { files: [{ filename: 'songs/pl/test.xml' }], ahead_by: 1 } };
    assert.equal(shouldDeleteBranch(branchMerged, diff), true);

    const branchClosed = {
        name: 'se-2026-11-08-test',
        associatedPullRequests: {
            edges: [
                { node: { number: 123, closed: true, merged: false } }
            ]
        }
    };
    assert.equal(shouldDeleteBranch(branchClosed, diff), true);
});

test('shouldDeleteBranch: retains branches with an open PR', () => {
    const branchOpen = {
        name: 'se-2026-11-08-test',
        associatedPullRequests: {
            edges: [
                { node: { number: 123, closed: false, merged: false } }
            ]
        }
    };
    const diff = { data: { files: [{ filename: 'songs/pl/test.xml' }], ahead_by: 1 } };
    assert.equal(shouldDeleteBranch(branchOpen, diff), false);

    const branchMixed = {
        name: 'se-2026-11-08-test',
        associatedPullRequests: {
            edges: [
                { node: { number: 120, closed: true, merged: true } },
                { node: { number: 123, closed: false, merged: false } }
            ]
        }
    };
    assert.equal(shouldDeleteBranch(branchMixed, diff), false);
});
