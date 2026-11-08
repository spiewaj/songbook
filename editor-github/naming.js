export function slugifyTitle(title) {
    if (!title) return "nowa_piosenka";
    const polishChars = {
        'ą': 'a', 'ć': 'c', 'ę': 'e', 'ł': 'l', 'ń': 'n', 'ó': 'o', 'ś': 's', 'ź': 'z', 'ż': 'z',
        'Ą': 'A', 'Ć': 'C', 'Ę': 'E', 'Ł': 'L', 'Ń': 'N', 'Ó': 'O', 'Ś': 'S', 'Ź': 'Z', 'Ż': 'Z'
    };
    let slug = title.split('').map(c => polishChars[c] || c).join('');
    slug = slug.trim().replaceAll(/[^a-zA-Z0-9_\-]/g, '_').replaceAll(/_+/g, '_');
    slug = slug.replace(/^_+|_+$/g, '');
    return slug || "nowa_piosenka";
}

export function getDirForGenre(genre) {
    if (!genre) return "songs/pl/turystyczne";
    const g = genre.toLowerCase().trim();
    if (g.includes("harc")) return "songs/pl/harc";
    if (g.includes("szant")) return "songs/pl/szanty";
    if (g.includes("poezj")) return "songs/pl/poezja";
    if (g.includes("kolęd") || g.includes("koled")) return "songs/pl/koledy";
    if (g.includes("religij")) return "songs/pl/religijne";
    if (g.includes("kabaret")) return "songs/pl/kabaret";
    if (g.includes("ludow") || g.includes("folk")) return "songs/pl/folk";
    if (g.includes("pop") || g.includes("rock")) return "songs/pl/pop";
    if (g.includes("bard")) return "songs/pl/bardowie";
    if (g.includes("turyst") || g.includes("górsk") || g.includes("gorsk")) return "songs/pl/turystyczne";
    return "songs/pl/turystyczne";
}

export function sanitizeBranchName(br) {
    if (!br) return "se-branch";
    return br.replaceAll(/[^a-zA-Z0-9.\-_]/g, "_");
}

export const SONGEDITOR_BRANCH_REGEXP = /^se-.*/;

export function shouldDeleteBranch(branch, diff) {
    if (!branch || !branch.name || !branch.name.match(SONGEDITOR_BRANCH_REGEXP)) {
        return false;
    }
    // 1. If branch has no changes (files.length === 0 or ahead_by === 0)
    if (!diff || !diff.data || !diff.data.files || diff.data.files.length === 0 || diff.data.ahead_by === 0) {
        return true;
    }
    // 2. If all associated PRs are closed or merged (no open PRs, and at least one closed or merged PR)
    if (branch.associatedPullRequests && branch.associatedPullRequests.edges && branch.associatedPullRequests.edges.length > 0) {
        const hasOpenPr = branch.associatedPullRequests.edges.some(e => !e.node.closed);
        const hasMergedOrClosedPr = branch.associatedPullRequests.edges.some(e => e.node.closed || e.node.merged);
        if (!hasOpenPr && hasMergedOrClosedPr) {
            return true;
        }
    }
    return false;
}
