import {createOAuthUserAuth} from "@octokit/auth-app";
import {Octokit} from "@octokit/rest";
import {RequestError} from "@octokit/request-error";
import util from "util";
import {graphql}  from "@octokit/graphql";
import crypto from "crypto";
import {oauthAuthorizationUrl} from "@octokit/oauth-authorization-url";

const USER_AGENT="songbook/0.1.0";

const OAUTH_APP_SECRET = process.env.OAUTH_APP_SECRET;

export const OAUTH_CLIENT_ID = process.env.OAUTH_CLIENT_ID;

export const BASE_URL = process.env.BASE_URL;
export const EDITOR_DOMAIN = process.env.EDITOR_DOMAIN;
export const EDITOR_PATH = process.env.EDITOR_PATH;
export const PARENT_DOMAIN = process.env.PARENT_DOMAIN;


export const EDITOR_BASE_URL = EDITOR_DOMAIN + EDITOR_PATH

export const CHANGES_BASE_URL = BASE_URL + "/changes";
export const REDIRECT_BASE_URL = BASE_URL + "/redirect";
export const CONFIG_BASE_URL = BASE_URL + "/config";
export const AUTH_URL = BASE_URL + "/auth";

export const GITHUB_OWNER='spiewaj';
export const MAIN_BRANCH_NAME="songeditor-main-spiewaj.com";

export async function getFileFromBranch(octokit, user, branchName) {
    let diff = await octokit.rest.repos.compareCommitsWithBasehead({
        owner: GITHUB_OWNER,
        repo: 'songbook',
        basehead: `main...${user}:songbook:${branchName}`
    });
    return diff.data.files.length>0 ? diff.data.files[0].filename : null;
}

export function htmlPrefix(res) {
    res.write(`<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/html" lang="pl-PL">
  <head>
    <meta charset="UTF-8">
    <title>Edytor piosenek</title>
    <script>
      function deleteBranch(user, branch) {
        if (confirm("Czy na pewno chcesz skasować zmianę: '" +branch + "'?")) {
          let url='${BASE_URL}/users/' + user + '/changes/' + branch;
          fetch(url, {method:'DELETE'})
            .then(() => window.location.reload());
        }
      }
    </script>
    <link href="https://fonts.googleapis.com/icon?family=Material+Icons" rel="stylesheet">
    <link href="/editor.css" rel="stylesheet">
  </head>
  <body>
    <div>
      <a href="${EDITOR_DOMAIN}">[Piosenki]</a>
      <a href="/users/me/changes:new">[Nowa]</a>
      <a href="/changes">[Inne rozpoczęte edycje]</a>
    </div>
`);
}

export function htmlSuffix(res) {
    if (!res.writableEnded) {
        res.write(`
  </body>
</html>`);
        res.end();
    } else {
        console.log("Response already ended")
    }
}

function fullUrl(req) {
    return new URL(`${req.protocol}://${req.get('host')}${req.originalUrl}`);
}

export function stripProtocol(s) {
    return s.replace("http://", "").replace("https://","");
}

function getBackUrl(req, backUrl) {
    if (backUrl) {
        console.log("Using back URL", backUrl);
        return backUrl;
    }
    const u = fullUrl(req);
    if (req.method=='GET' && !stripProtocol(u.href).startsWith(stripProtocol(REDIRECT_BASE_URL))) {
        console.log("Using back URL based on req: ", u.href);
        return u.href;
    }
    console.log("Using the default back URL:" + CHANGES_BASE_URL);
    return CHANGES_BASE_URL;
}

export function clearCookiesAndAuthRedirect(res, backUrl) {
    console.log("clearCookiesAndAuthRedirect: backUrl", backUrl);
    if (res.headersSent) {
        console.log("clearCookiesAndAuthRedirect: Headers already sent")
    } else {
        console.log("clearCookiesAndAuthRedirect: Headers not yet sent")
    }
    const state = crypto.randomUUID();
    res.clearCookie("session", {domain: PARENT_DOMAIN});
    res.cookie("state", state);
    res.cookie("redirectUrl", backUrl);

    const {url} =
        oauthAuthorizationUrl({
            clientType: "oauth-app",
            clientId: OAUTH_CLIENT_ID,
            redirectUrl: REDIRECT_BASE_URL,
            scopes: ["public_repo", "workflow"],
            state: state,
        });
    res.redirect(url);
    if (res.headersSent) {
        console.log("clearCookiesAndAuthRedirect: Headers finally sent - AFTER redirect to:", url)
    } else {
        console.log("clearCookiesAndAuthRedirect: Headers not yet sent !!! ???")
    }
}

export async function newUserOctokit(req,res, backUrl) {
    let access_token = req.cookies.session ? req.cookies.session.access_token
        : null;
    let authuser = req.cookies.session ? req.cookies.session.user : null;
    // console.log("access token from cookie: ", access_token)
    if (!access_token || !authuser) {
        //TODO(ptab): Compare secret with the cookie.
        const authData = {
            clientId: OAUTH_CLIENT_ID,
            clientSecret: OAUTH_APP_SECRET,
            code: req.query.code,
            state: req.query.state,
            redirectUrl: REDIRECT_BASE_URL,
            log: console,
        };

        const auth = await createOAuthUserAuth(authData);
        try {
            const {token} = await auth();
            access_token = token;
        } catch (e) {
            console.log("Catched error(1):", e);
            console.log("Catched error(2):", e.status, e instanceof RequestError);

            clearCookiesAndAuthRedirect(res, getBackUrl(req, backUrl));

            return {octkokit: null,authuser:null,user:null,mygraphql:null};
        }
        const octokit = new Octokit({
            userAgent: USER_AGENT,
            auth: access_token,
            log: console,
        });
        const authenticated = await octokit.rest.users.getAuthenticated();
        authuser = authenticated.data.login;
        console.log(util.inspect(authenticated, false, null, false));
        res.cookie("session", {
                "access_token": access_token,
                "user": authuser},
            { maxAge: 3*24*60*60*1000, httpOnly: true, sameSite:'none', secure: true, domain: PARENT_DOMAIN });
        res.cookie("new", "false", { maxAge: 31536000});
    }
    const usr = (!req.params.user || req.params.user === 'me') ? authuser : req.params.user;
    console.log('Acting as user:', usr);
    let mygraphql = graphql.defaults({
        headers: {
            "Authorization": "bearer " + access_token
        },
    });

    return {
        octokit: new Octokit({
            userAgent: USER_AGENT,
            auth: access_token,
            log: console,
        }),
        mygraphql: async function(query, params) {
            return mygraphql(query, params).catch(function (e) {
                console.log("wrapRedirectToConfigIfNeeded: Got error:", e);
                console.log("wrapRedirectToConfigIfNeeded: Got error message:", e.message);
                if (e.message.includes("Could not resolve to a Repository with the name")) {
                    console.log("redirecting to config...");
                    // TODO: Might set a redirect address.
                    res.redirect(CONFIG_BASE_URL);
                }
                return e
            })
        },
        authuser: authuser,
        user: usr
    }
}


export async function fetchBranch(octokit, user, branchName) {
    try {
        console.log("fetchingBranch", user, branchName)
        return await octokit.rest.repos.getBranch(
            {owner: user, repo: 'songbook', 'branch': branchName});
    } catch (e) {
        if (e instanceof RequestError && e.status===404) {
            console.log("fetchBranch returning null (due to 404)")
            return null;
        }
        console.log("Rethrowing e", JSON.stringify(e))
        throw e;
    }
}

export async function ensureForkExists(octokit, user) {
    try {
        await octokit.rest.repos.get({owner: user, repo: "songbook"});
        return;
    } catch (e) {
        if (!(e instanceof RequestError && e.status === 404)) {
            throw e;
        }
    }
    console.log(`Repository ${user}/songbook not found. Creating fork from ${GITHUB_OWNER}/songbook...`);
    await octokit.rest.repos.createFork({owner: GITHUB_OWNER, repo: "songbook"});
    const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
    for (let i = 0; i < 10; i++) {
        await delay(2000);
        const mainBranch = await fetchBranch(octokit, user, "main");
        if (mainBranch) {
            console.log(`Fork ${user}/songbook is ready (attempt ${i + 1})`);
            return;
        }
    }
    console.warn(`Fork ${user}/songbook creation waited max attempts, proceeding...`);
}

async function pullUpstreamIntoMainBranch(octokit, user) {
    const res = await octokit.request('POST /repos/{owner}/{repo}/pulls', {
        owner: user,
        repo: 'songbook',
        title: 'Automated creation of songbook-main branch.',
        body: 'Should get automatically merged.',
        head: GITHUB_OWNER + ':songbook:main',
        base: MAIN_BRANCH_NAME
    });
    console.log("Created pull request", JSON.stringify(res));
    const merge = await octokit.request('PUT /repos/{owner}/{repo}/pulls/{pull_number}/merge', {
        owner: user,
        repo: 'songbook',
        pull_number: res.data.number
    });
    console.log("Merging", JSON.stringify(merge));
}

export async function prepareMainBranch(octokit, user) {
    let branch = await fetchBranch(octokit, user, MAIN_BRANCH_NAME);
    let originBranch = await fetchBranch(octokit, GITHUB_OWNER, 'main');
    console.log("originBranch", JSON.stringify(originBranch));
    if (!branch) {
        await ensureForkExists(octokit, user);
        try {
            await octokit.rest.git.createRef({
                owner: user,
                repo: 'songbook',
                "ref": "refs/heads/" + MAIN_BRANCH_NAME,
                "sha": originBranch.data.commit.sha
            });
            return fetchBranch(octokit, user, MAIN_BRANCH_NAME);
        } catch (e) {
            console.log("Direct createRef with origin sha failed, falling back to base commit + PR merge:", e.message);
            // We use really old commit as (originBranch.data.commit.sha) was sometimes not pulled from the repository.
            await octokit.rest.git.createRef({
                owner: user,
                repo: 'songbook',
                "ref": "refs/heads/" + MAIN_BRANCH_NAME,
                "sha": 'c21af496c93eecd96902d8ee01c994b9ec2e8157'
            });
            await pullUpstreamIntoMainBranch(octokit, user);
        }
    }
    // For repositories that got forked from github.com/wdw21/songbook... 
    // the upstream branch would not be github.com/spiewaj/songbook.
    // await octokit.rest.repos.mergeUpstream({owner: user, repo: 'songbook', 'branch': MAIN_BRANCH_NAME});
    // https://github.com/octokit/rest.js/issues/339
    let updateCmd = {owner: user, repo: 'songbook', "ref": "heads/" + MAIN_BRANCH_NAME, "sha": originBranch.data.commit.sha, "force": true};
    console.log("updateCmd", JSON.stringify(updateCmd));
    try {
        const updateRef = await octokit.rest.git.updateRef(updateCmd);
        console.log("UpdateRef", JSON.stringify(updateRef));
    } catch (e) {
        console.log("updateRef failed, pulling upstream via PR first:", e.message);
        await pullUpstreamIntoMainBranch(octokit, user);
        const updateRef = await octokit.rest.git.updateRef(updateCmd);
        console.log("UpdateRef after PR merge", JSON.stringify(updateRef));
    }
    
    return fetchBranch(octokit, user, MAIN_BRANCH_NAME);
}

export async function prepareBranch(octokit, user, branchName) {
    console.log("prepareBranch")
    let branch = await fetchBranch(octokit, user, branchName);
    if (branch) {
        return branch;
    }
    let mainBranch = await prepareMainBranch(octokit, user);
    console.log("prepareBranch (main): ", JSON.stringify(mainBranch));

    await octokit.rest.git.createRef({owner: user, repo: 'songbook', "ref": "refs/heads/" + branchName, "sha": mainBranch.data.commit.sha});
    return fetchBranch(octokit, user, branchName);
}

export function editorLink(user, branchName, file, autocommit, maybeNew) {
    let url = new URL(EDITOR_BASE_URL);
    url.searchParams.set('baseUrl', BASE_URL);
    url.searchParams.set('branch', branchName);
    url.searchParams.set('file', file);
    url.searchParams.set('user', user);
    if (autocommit) {
        url.searchParams.set('commitOnLoad', 'true');
    }
    if (maybeNew) {
        url.searchParams.set('new', 'maybe');
    }
    return url.href;
}

export function HandleError(e, res) {
    console.log("HttpError", e);
    const errMsg = e?.response?.data?.message || e?.message || "";
    if (!res.headersSent && (
        (e instanceof RequestError && e.status === 401) ||
        errMsg.includes("refusing to allow an OAuth App to")
    )) {
        // HttpError RequestError [HttpError]: Bad credentials
        // status: 422,  E.g. HttpError: refusing to allow an OAuth App to create or update workflow `.github/workflows/generate.yml` without `workflow` scope
        res.redirect(AUTH_URL);
        return;
    }
    if (!res.writableEnded) {
        res.write(`<hr/><details><summary>Error</summary><pre>`);
        res.write(util.inspect(e, false, null, false));
        res.end(`</pre></details></body></html>`);
    }
}
