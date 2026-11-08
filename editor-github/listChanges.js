import {newUserOctokit, htmlPrefix, htmlSuffix, HandleError, GITHUB_OWNER, EDITOR_DOMAIN} from './common.js'
import {SONGEDITOR_BRANCH_REGEXP, shouldDeleteBranch} from './naming.js'
import util from "util";

export async function cleanupChanges(req, res) {
    try {
        const refsData = await getRefs(req, res);
        if (!refsData) {
            return;
        }
        const {refs, diffs, user, octokit} = refsData;
        const deletePromises = [];
        let deletedCount = 0;

        for (let i = 0; i < refs.length; ++i) {
            let branch = refs[i];
            if (!branch.name.match(SONGEDITOR_BRANCH_REGEXP)) {
                continue;
            }

            let diff = null;
            try {
                diff = await diffs.get(branch.name);
            } catch (e) {
                console.log(`Failed to fetch diff for ${branch.name}:`, e.message);
            }

            if (shouldDeleteBranch(branch, diff)) {
                deletePromises.push(
                    octokit.rest.git.deleteRef({
                        owner: user,
                        repo: 'songbook',
                        ref: "heads/" + branch.name
                    }).then(() => {
                        deletedCount++;
                    }).catch(e => {
                        console.error(`Failed to delete branch ${branch.name} for ${user}:`, e.message);
                    })
                );
            }
        }

        await Promise.all(deletePromises);
        res.redirect(`/users/${user}/changes?cleaned=${deletedCount}`);
    } catch (e) {
        HandleError(e, res);
    }
}

async function getRefs(req, res) {
    const {octokit, user, mygraphql} = await newUserOctokit(req, res);
    if (!octokit) {
        return null;
    }
    let r = await mygraphql(`query ($user:String!, $repo:String!){
  repository(owner:$user,name:$repo) {
    url
    parent {
      id
      name
      owner {
        id
        login
      }
    }
    refs(last: 100, refPrefix:"refs/heads/", orderBy: {field:TAG_COMMIT_DATE, direction:DESC}) {
      nodes {
        id
        name
        associatedPullRequests(last:5) {
          edges {
            node {
              id
              title
              number
              url
              closed
              closedAt
              changedFiles
              merged
            }
          }
        }
        target {
        ... on Commit {
            changedFilesIfAvailable,
            commitSHA: oid
            committedDate,
            commitUrl,
            url,
              history(first: 2) {
              nodes {
                id
                oid
                commitUrl
                messageHeadline
                committedDate
              }
            }
          }
        }
      }
    }
  }
}`,
        {
            user: user,
            repo: "songbook"
        });

    if (!r || !r.repository) {
        return null;
    }

    const diffs = new Map();
    const refs = r.repository.refs.nodes;

    console.log("Refs size before sort", refs.length);

    refs.sort((a, b) => {
        if (!a || !a.target || !a.target.committedDate) {
            return 1;
        }
        if (!b || !b.target || !a.target.committedDate) {
            return -1;
        }
        return -a.target.committedDate.localeCompare(b.target.committedDate)
    });
    console.log("Refs size after sort", refs.length);

    for (let i = 0; i < refs.length; ++i) {
        let branch = refs[i];
        console.log("Considering: " + branch.name, i, branch.name.match(SONGEDITOR_BRANCH_REGEXP));
        if (branch.name.match(SONGEDITOR_BRANCH_REGEXP)) {
            console.log("Processing: " + branch.name, i);
            diffs.set(branch.name, octokit.rest.repos.compareCommitsWithBasehead({
                owner: GITHUB_OWNER,
                repo: 'songbook',
                basehead: `main...${user}:songbook:${branch.name}`
            }));
        }
    }

    return {refs, diffs, user, octokit, r};
}

export async function listChanges(req, res) {
    try {
        const refsData = await getRefs(req, res);
        if (!refsData) {
            return;
        }
        const {refs, diffs, user, r} = refsData;

        // Collect all valid branches that have file diffs and commits ahead of main
        const validChanges = [];
        for (let i = 0; i < refs.length; ++i) {
            let branch = refs[i];
            if (branch.name.match(SONGEDITOR_BRANCH_REGEXP)) {
                const diff = await diffs.get(branch.name);
                if (diff && diff.data.files && diff.data.files.length >= 1 && diff.data.ahead_by > 0) {
                    validChanges.push({ branch, diff });
                }
            }
        }

        htmlPrefix(res);
        res.write(`
      <div class="page-header">
        <div>
          <h1>Rozpoczęte edycje</h1>
          <p class="page-subtitle">Robocze wersje piosenek na Twoim koncie (<strong>${user}</strong>). Możesz kontynuować edycję lub zgłosić zmiany do publikacji w śpiewniku.</p>
        </div>
        <div class="header-actions">
          <a href="/users/${user}/changes:new" class="btn btn-primary"><i class="material-icons">add</i> Dodaj piosenkę</a>
          <form method="post" action="/users/${user}/changes:cleanup" style="display:inline;" onsubmit="return confirm('Czy na pewno chcesz usunąć wszystkie puste i już scalone gałęzie robocze?');">
            <button type="submit" class="btn btn-secondary" title="Usunie z Twojego repozytorium gałęzie bez zmian lub te, których PR został już połączony"><i class="material-icons">cleaning_services</i> Wyczyść stare edycje</button>
          </form>
        </div>
      </div>
`);

        const cleanedCount = req.query.cleaned;
        if (cleanedCount !== undefined) {
            const countNum = parseInt(cleanedCount, 10);
            if (countNum > 0) {
                res.write(`
      <div class="alert alert-success">
        <i class="material-icons">check_circle</i>
        <span>Pomyślnie wyczyszczono ${countNum} ${countNum === 1 ? 'starą gałąź roboczą' : (countNum < 5 ? 'stare gałęzie robocze' : 'starych gałęzi roboczych')}.</span>
      </div>
`);
            } else {
                res.write(`
      <div class="alert alert-info">
        <i class="material-icons">info</i>
        <span>Wszystkie gałęzie są aktualne – brak starych edycji do usunięcia.</span>
      </div>
`);
            }
        }

        if (validChanges.length === 0) {
            res.write(`
      <div class="empty-state-card">
        <i class="material-icons empty-icon">check_circle_outline</i>
        <h3>Brak otwartych edycji</h3>
        <p>Wszystkie Twoje zmiany zostały już wysłane lub nie rozpocząłeś jeszcze żadnej nowej edycji.</p>
        <div class="empty-actions">
          <a href="/users/${user}/changes:new" class="btn btn-primary btn-lg"><i class="material-icons">add</i> Dodaj nową piosenkę</a>
          <a href="${EDITOR_DOMAIN}" class="btn btn-secondary btn-lg"><i class="material-icons">queue_music</i> Przeglądaj piosenki</a>
        </div>
      </div>
`);
        } else {
            res.write(`
      <div class="table-container">
        <table class="changes-table">
          <thead>
            <tr>
              <th>Piosenka</th>
              <th>Ostatnia zmiana</th>
              <th>Status recenzji</th>
              <th>Akcje</th>
              <th>Szczegóły</th>
            </tr>
          </thead>
          <tbody>
`);

            for (const {branch, diff} of validChanges) {
                const fileObj = diff.data.files[0];
                const rawPath = fileObj.filename.replace(/^songs\//, "");
                const fileName = rawPath.split("/").pop().replace(/\.xml$/, "");
                const displayTitle = fileName.replace(/_/g, " ");
                const isNew = fileObj.status === 'added';
                const dateStr = branch.target && branch.target.committedDate
                    ? new Date(branch.target.committedDate).toLocaleString("pl-PL")
                    : "-";

                res.write(`            <tr>\n`);

                // Column: Song title + path
                res.write(`              <td>
                <div class="song-title-row">
                  ${isNew ? '<span class="badge badge-new">Nowa</span>' : ''}
                  <span class="song-title">${displayTitle}</span>
                </div>
                <div class="song-path">${rawPath}</div>
              </td>\n`);

                // Column: Date
                res.write(`              <td>${dateStr}</td>\n`);

                // Column: Status recenzji
                res.write(`              <td>\n`);
                if (branch.associatedPullRequests && branch.associatedPullRequests.edges && branch.associatedPullRequests.edges.length > 0) {
                    const pr = branch.associatedPullRequests.edges[0].node;
                    if (pr.merged) {
                        res.write(`                <a class="badge badge-merged" href="${pr.url}" target="_blank" rel="noopener"><i class="material-icons">done_all</i> PR #${pr.number} (Scalony)</a>\n`);
                    } else if (pr.closed) {
                        res.write(`                <a class="badge badge-closed" href="${pr.url}" target="_blank" rel="noopener"><i class="material-icons">close</i> PR #${pr.number} (Zamknięty)</a>\n`);
                    } else {
                        res.write(`                <a class="badge badge-pr" href="${pr.url}" target="_blank" rel="noopener"><i class="material-icons">merge_type</i> PR #${pr.number} (W recenzji)</a>\n`);
                    }
                } else {
                    res.write(`                <a class="btn btn-sm btn-success" href="/users/${user}/changes/${branch.name}:publish"><i class="material-icons">publish</i> Zgłoś do recenzji</a>\n`);
                }
                res.write(`              </td>\n`);

                // Column: Actions (Edit + Delete)
                res.write(`              <td>
                <div class="cell-actions">
                  <a class="btn btn-sm btn-primary" href="/users/${user}/changes/${branch.name}:edit"><i class="material-icons">edit</i> Edytuj</a>
                  <button class="btn btn-sm btn-danger-outline" onclick="deleteBranch('${user}','${branch.name}')" title="Usuń tę wersję roboczą"><i class="material-icons">delete</i> Usuń</button>
                </div>
              </td>\n`);

                // Column: Technical details
                res.write(`              <td>
                <span class="branch-tag" title="${branch.name}">${branch.name}</span>
                <div class="meta-links">
                  <a href="${r.repository.url}/tree/${branch.name}" target="_blank" rel="noopener">gałąź</a> &bull;
                  <a href="${branch.target.commitUrl}" target="_blank" rel="noopener">commit</a>
                </div>
              </td>\n`);

                res.write(`            </tr>\n`);
            }

            res.write(`          </tbody>
        </table>
      </div>\n`);
        }

        res.write(`
      <details class="debug-panel">
        <summary><i class="material-icons">code</i> Informacje diagnostyczne (dla redaktorów)</summary>
        <div class="debug-content">
          <pre>${util.inspect(r, false, null, false)}</pre>
`);

        for (let [key, value] of diffs) {
            res.write(`          <hr/><h3>diff: ${key}</h3><pre>${util.inspect(await value, false, null, false)}</pre>\n`);
        }

        res.write(`        </div>
      </details>\n`);
    } catch (e) {
        HandleError(e, res);
    } finally {
        htmlSuffix(res);
    }
}