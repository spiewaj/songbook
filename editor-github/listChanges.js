import {newUserOctokit, htmlPrefix, htmlSuffix, HandleError,GITHUB_OWNER} from './common.js'
import util from "util";

const SONGEDITOR_BRANCH_REGEXP=/^se-.*/g;

export async function cleanupChanges(req, res) {
    const {refs, diffs, user, octokit} = await getRefs(req, res);
    // Let's delete empty & merged branches.
    for (let i = 0; i < refs.length; ++i) {
        let branch = refs[i];
        if (branch.name.match(SONGEDITOR_BRANCH_REGEXP)) {
            const diff = await diffs.get(branch.name);
            if (diff.data.files.length === 0) {
                octokit.rest.git.deleteRef({owner: user, repo: 'songbook', "ref": "heads/" + branch.name}).then();
                continue;
            }
            if (branch.associatedPullRequests.edges.length > 0) {
                let merged = true;
                for (const edge of branch.associatedPullRequests.edges) {
                    if (!edge.node.closed || !edge.node.merged) {
                        merged = false;
                    }
                }
                if (merged) {
                    octokit.rest.git.deleteRef({owner: user, repo: 'songbook', "ref": "heads/" + branch.name}).then();
                }
            }
        }
    }
    res.redirect(`/users/${user}/changes`);
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
        const {refs, diffs, user, r} = await getRefs(req, res);
        console.log('2',refs);

        htmlPrefix(res);
        res.write(`
    <h2>Rozpoczęte edycje</h2>
    <table>
      <tr><th>Plik</th> <th>Ostatnia zmiana</th> <th>Akcje</th> <th>Status recenzji</th> <th>Zaawansowane</th> </tr>
`);

        for (let i = 0; i < refs.length; ++i) {
            let branch = refs[i];
            if (branch.name.match(SONGEDITOR_BRANCH_REGEXP)) {
                const diff = await diffs.get(branch.name);
                if (!diff || diff.data.files.length < 1) {
                    continue;
                }

                res.write(`<td>${diff.data.files[0].status === 'added' ? 'Nowy:' : ''} ${diff.data.files[0].filename.replaceAll("songs/", "")}</td>`)

                res.write(`<td>${new Date(branch.target.committedDate).toLocaleString("pl-PL")}</td>`)


                res.write(`<td>
        <a href="/users/${user}/changes/${branch.name}:edit">[Edytuj]</a>
        <button onclick="deleteBranch('${user}','${branch.name}')">Usuń</button></td>`);

                res.write(`<td>`);
                if (branch.associatedPullRequests.edges.length > 0) {
                    let pr = branch.associatedPullRequests.edges[0].node;
                    res.write(`<a href="${pr.url}">[W recenzji]</a>`);
                } else {
                    res.write(`<a href="/users/${user}/changes/${branch.name}:publish">[Wyślij do recenzji]</a>`);
                }
                res.write(`</td>`);

                res.write(`<td>
         ${branch.name}<br/>
         <a href="${r.repository.url}/tree/${branch.name}">[branch]</a><br/>
         <a href="${branch.target.commitUrl}">[commit]</a>
      </td>`);
                res.write(`</tr>`);
            }
        }

        res.write(`
    </table>

    <a id="newChange" href="/users/${user}/changes:new"><span class="material-icons">add_circle</span>[Nowa zmiana]</a>
    
    <form method="post" action="/users/${user}/changes:cleanup">
        <input type="submit" value="Usuń puste edycje"></input>
    </form>
    
    <details>
      <summary>[Magia pod spodem]</summary>
      <pre>${util.inspect(r, false, null, false)}</pre>`);

        for (let [key, value] of diffs) {
            res.write(`<hr/><h3>diff: ${key}</h3><pre>${util.inspect(await value, false, null, false)}</pre>\n`);
        }
        res.write(`
    </details>`);
    } catch (e) {
        HandleError(e, res);
    } finally {
        if (!res.headersSent) {
            htmlSuffix(res);
        }
    }
}