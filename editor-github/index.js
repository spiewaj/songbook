import {oauthAuthorizationUrl} from "@octokit/oauth-authorization-url";
import {http} from '@google-cloud/functions-framework';
import {RequestError} from "@octokit/request-error";
import express from 'express';
import util from 'util';
import cookieParser from "cookie-parser";
import cors from 'cors';
import path from 'path';
import * as http_ from 'http';
import * as https_ from 'https';

import * as fs from 'fs';

import libxmljs2 from "libxmljs2";

import {cleanupChanges, listChanges} from './listChanges.js';
import {
    AUTH_URL,
    BASE_URL,
    EDITOR_DOMAIN,
    CHANGES_BASE_URL,
    CONFIG_BASE_URL,
    OAUTH_CLIENT_ID,
    newUserOctokit,
    getFileFromBranch,
    htmlSuffix,
    htmlPrefix,
    MAIN_BRANCH_NAME,
    prepareBranch, editorLink,
    prepareMainBranch,
    stripProtocol,
    HandleError, EDITOR_BASE_URL, PARENT_DOMAIN, clearCookiesAndAuthRedirect, REDIRECT_BASE_URL,
    GITHUB_OWNER
} from './common.js';

const app = express();

app.use(cookieParser());

// Allow multiple origins for CORS
const allowedOrigins = [
    EDITOR_DOMAIN,
    BASE_URL,
    `https://${PARENT_DOMAIN}`,
    'https://spiewaj.com',
    'https://ghe.spiewaj.com',
    'http://localhost:63342',
    'http://localhost:8080'
].filter(Boolean); // Remove any undefined values

app.use(cors({
    origin: function(origin, callback) {
        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin) return callback(null, true);
        
        if (allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            console.warn(`CORS blocked origin: ${origin}`);
            callback(new Error('Not allowed by CORS: ' + origin));
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Cookie']
}));

//app.use(logRequest)
//app.use(errorHandleWrapper)
//app.use(errorHandle)
// app.use((err, req, res, next) => {
//
//     next(res);
// })

app.get('/', async (req, res) => {
    if (req.cookies.new === 'false') {
        res.redirect(CHANGES_BASE_URL);
    } else {
        res.redirect("/intro");
    }
});

app.get('/changes', async (req, res) => {
    const {octokit, user} =
        await newUserOctokit(req, res);
    if (!octokit) {
        return;
    }
    res.redirect(`/users/${user}/changes`)
});


app.get('/songs', async (req, res) => {
    const {octokit, user} = await newUserOctokit(req, res);
    if (!octokit) return;
    res.redirect(`/users/${user}/songs`)
});

app.use(express.static('static'));

app.get('/users/:user/changes', listChanges);
app.post('/users/:user/changes[:]cleanup', cleanupChanges);

app.get('/users/:user/changes/:branch[:]edit', async (req, res) => {
    const branchName = req.params.branch;
    const {octokit,  user} = await newUserOctokit(req, res);
    if (!octokit) return;
    let file = await getFileFromBranch(octokit, user, branchName);
    res.redirect(editorLink(user, branchName, file, false, false));
});

app.delete('/users/:user/changes/:branch', async (req, res) => {
    const branchName = req.params.branch;
    const {octokit, user} = await newUserOctokit(req, res);
    if (!octokit) return;

    await octokit.rest.git.deleteRef({owner: user, repo: 'songbook', "ref": "heads/" + branchName});
    res.send("Deleted");
});

async function getPullRequest(octokit, user, branchName) {
    const res = await octokit.request('GET /repos/{owner}/{repo}/pulls{?state,head,base,sort,direction,per_page,page}', {
        owner: GITHUB_OWNER,
        repo: 'songbook',
        head: `${user}:${branchName}`,
    })
    console.log("getPullRequest: " + JSON.stringify(res))
    return res.status=200 && res.data.length>0 ? res.data[0] : null
}

async function getCommitsDifferenceMsg(octokit, user, branchName) {
    const commits = await octokit.request('GET /repos/{owner}/{repo}/compare/{basehead}{?page,per_page}', {
        owner: user,
        repo: 'songbook',
        basehead: `${MAIN_BRANCH_NAME}...${branchName}`
    })
    let msg="";
    for (let commit of commits.data.commits) {
        msg+=commit.commit.message + "\n"
    }
    return msg;
}

async function prDescription(octokit, user, branchName) {
    let file = await getFileFromBranch(octokit, user, branchName);
    let link = editorLink(user, branchName, file, false);
    let msg = await getCommitsDifferenceMsg(octokit, user, branchName);
    let body = `
[Link do edytora](${link})\n\n${msg}\n\nZa kilka minut pojawi się tu wyrenderowana piosenka (PDF).
Ktoś też zrecenzuje/zaakceptuje Twoje zmiany. Może też mieć tutaj dodatkowe komentarze/pytania.\n
Możesz zawsze wrócić do [edytora](${link}) by nanieść dodatkowe poprawki.`;
    return { body, file }
}

// We prepare a form, such that user can do final commit.
async function publishByGet(req, res) {
    const {octokit, user} = await newUserOctokit(req, res);
    const branchName = req.params.branch;
    const {body, file} = prDescription(octokit, user, branchName)
    let url = `https://github.com/${GITHUB_OWNER}/songbook/compare/main...${user}:songbook:${branchName}?title=Piosenka: ${encodeURIComponent(file)}&expand=1&body=${encodeURIComponent(body)}`
    res.redirect(url);
}

async function publishByPost(req, res) {
    const {octokit, user} = await newUserOctokit(req, res);
    const branchName = req.params.branch;
    const existingPr = await getPullRequest(octokit, user, branchName);
    if (existingPr != null) {
        res.redirect(existingPr.html_url);
        return
    }
    const {body, file} = await prDescription(octokit, user, branchName)
    const response = await octokit.request('POST /repos/{owner}/{repo}/pulls', {
        owner: GITHUB_OWNER,
        repo:  'songbook',
        title: `Piosenka: ${file}`,
        body: body,
        head: `${user}:${branchName}`,
        base: 'main'
    })
    console.log("Creation of PULL request returned:" + JSON.stringify(response))
    res.redirect(response.data.html_url);
}


app.get('/users/:user/changes/:branch[:]publish', async (req, res) => {
    await publishByPost(req, res);
});


async function getSongs(octokit, user) {
    let songs = await octokit.rest.repos.getContent(
        {owner: user, repo: 'songbook', path: 'songs', ref: MAIN_BRANCH_NAME})
    //console.log(util.inspect(songs, false, null, false));
    let os = [];
    for (let s of songs.data) {
        os.push({
            title: s.name.replaceAll(/.xml$/g, ""),
            filename: s.name,
            path: s.path,
        });
    }
    return os
}

async function getDirs(octokit, user) {
    let songs = await octokit.request('GET /repos/{owner}/{repo}/git/trees/{tree_sha}?recursive=1', {
        owner: user,
        repo: 'songbook',
        tree_sha: MAIN_BRANCH_NAME,
        headers: {
            'X-GitHub-Api-Version': '2022-11-28'
        }
    })
    let os = [];
    for (let s of songs.data.tree) {
        if (s.path.startsWith("songs/") && s.type === "tree") {
            os.push(s.path.replaceAll("songs/", ""))
        }
    }
    return os
}


app.get('/users/:user/changes[:]new', async (req, res) => {
    try {
        console.log("Starting request /users/:user/changes[:]new");
        const {octokit, user} = await newUserOctokit(req, res);
        if (!octokit) {
            console.log("No octokit in changes:NEW processing finished - exiting immedietely!!!");
            return;
        }
        console.log("Request query: ", req.query)
        console.log("Request query file: ", req.query.file)
        if (req.query.file) {
            let file = req.query.file;
            console.log("Got file: ", file)
            if (!file.toLowerCase().endsWith(".xml")) {
                file = file + ".xml";
            }
            return await newChange(file, octokit, user, res)
        }

        htmlPrefix(res);


        let dirs = await getDirs(octokit, user)

        res.write(`<datalist id="dirs">\n`);
        for (const dir of dirs) {
            res.write(`  <option>${dir}</option>\n`);
        }
        res.write(`</datalist>\n`);

        res.write(`
    <form action="/users/${user}/changes:new" method="post">
    <h1>Nowa edycja</h1>\n
      Wybierz katalog w którym chcesz umieścić piosenkę:
       <input name="dir" id='dir' type="text" list="dirs" /><br/>
       Podaj nazwę pliku - tytuł piosenki to dobry pomysł:
       <input name="file" id='file' type="text" required pattern="[a-zA-Z0-9\\.\\-_() ]+" 
        oninvalid="this.setCustomValidity('Pole musi być wypełnione i zawierać wyłącznie podstawowe litery, cyfry, myślnik i podkreślnik.')"
        oninput="this.setCustomValidity('')"/>
      <div>
        <input type="submit" value="Rozpocznij edycję"/>
      </div>
    </form>`);
    } catch (e) {
        HandleError(e, res);
    } finally {
        htmlSuffix(res);
        console.log("!!! /changes:NEW processing finished !!!");
    }
});

function sanitizeBranchName(br) {
    return br.replaceAll(/[^a-zA-Z0-9.\-_]/g, "_");
}

async function newChange(file, octokit, user, res) {
    try {
        console.log("newChange started (2024-06-30)")
        let today = new Date().toISOString().slice(0, 10);
        let rand = Math.floor(Math.random() * 10000);
        let branchName = sanitizeBranchName("se-" + today + "-" + rand + "-" + file);
        await prepareBranch(octokit, user, branchName)
        res.redirect(editorLink(user, branchName, "songs/" + file, true, true));
    } catch (e) {
        console.log("newChange EXCEPTION", e)
        // Don't know why generic handler is not executed.
        myErrorHandle(e, res);
        res.end();
        throw e;
    }
}

app.post('/users/:user/changes[:]new', express.urlencoded({extended: true}), async (req, res) => {
    //  console.log("BODY", JSON.stringify(req.body));
    let dir = req.body.dir ? req.body.dir.trim() : ""
    let file = req.body.file.trim().replaceAll(" ", "_").replaceAll(".xml", "")
    if (!file.toLowerCase().endsWith(".xml")) {
        file = file + ".xml";
    }
    console.log("[newChange] getting octokit...")
    const {octokit, user} = await newUserOctokit(req, res, `${BASE_URL}/users/me/changes:new?file=${encodeURIComponent(file)}&dir=${encodeURIComponent(dir)}`);
    if (!octokit) {
        console.log("Couldn't get octokit...")
        return
    }
    console.log("[newChange] got octokit. Preparing branch ...")
    let nc = await newChange(path.join(dir, file), octokit, user, res)
    console.log("users/:user/changes[:]new exited");
    return nc;
});

app.post('/users/:user/changes/:file[:]new', async (req, res) => {
    let file = req.params.trim();
    console.log("[newChange] getting octokit...")
    const {octokit, user} = await newUserOctokit(req, res, `${BASE_URL}/users/me/changes:new?file=${encodeURIComponent(file)}`);
    if (!octokit) {
        console.log("Couldn't get octokit...")
        return
    }
    console.log("[newChange] got octokit. Preparing branch ...")
    return newChange(file, octokit, user, res)
});

app.get('/users/:user/songs', async (req, res) => {
    try {
        console.log("Starting request /songs");
        const {octokit, user} = await newUserOctokit(req, res);
        if (!octokit) {
            return;
        }

        htmlPrefix(res);
        res.write(`
      <h1>Lista piosenek</h1>\n
      Wybierz plik, który będziesz edytował:
      `);

        let songs = await getSongs(octokit, user)

        res.write(`<ul>\n`);
        for (const song of songs) {
            res.write(`  <li>${song.title} <form action="/users/${user}/changes:new" method="post"><input type="hidden" name="file" value="${song.filename}"/><input type="submit" value="[ Edytuj ]"/></form></li>\n`);
        }
        res.write(`</ul>\n`);

        res.write(`
    <form action="/users/${user}/changes:new" method="post">
      <input name="file" id='file' type="text" list="files"/>
      <div>
        <input type="submit" value="Dodaj nową"/>
      </div>
    </form>`);
    } catch (e) {
        HandleError(e, res);
    } finally {
        htmlSuffix(res);
        console.log("!!! /songs processing finished !!!");
    }
});

app.get('/config', async (req, res) => {
    const {octokit, authuser} = await newUserOctokit(req, res);

    try {
        await octokit.rest.repos.get({owner: authuser, repo: "songbook"});
    } catch (e) {
        await octokit.rest.repos.createFork({owner: GITHUB_OWNER, repo: "songbook"});
        const delay = ms => new Promise(resolve => setTimeout(resolve, ms))
        await delay(3000);
    }

    await prepareMainBranch(octokit, authuser);
    res.redirect(`/users/${authuser}/changes`);
});

function myErrorHandle(e, res) {
    if (e instanceof RequestError && e.status===404) {
        console.log("Returning 404")
        res.status(404);
        res.send("Document not found");
    } if (e instanceof RequestError && e.status===401) {
        console.log("Got 401 -> Redirecting to /auth")
        res.redirect("/auth")
    } else {
        HandleError(e, res);
    }
}

async function validateSongXML(payload) {
    const xsd = fs.readFileSync(new URL('./song.xsd', import.meta.url)).toString()
    const xsdDoc = libxmljs2.parseXml(xsd);
    const song = libxmljs2.parseXml(payload);

    if (!song.validate(xsdDoc)) {
        console.warn("XML not VALID", payload)
        return JSON.stringify(song.validationErrors);
    } else {
        console.log("XML VALID :)")
        return null
    }
}

async function commit(branchName, file, msg, payload, req, res) {
    const {octokit, mygraphql, user} = await newUserOctokit(req, res);
    if (!octokit) {
        return;
    }


    console.log('Branch:', branchName);
    const branch = await prepareBranch(octokit, user, branchName)

    console.log(util.inspect(branch, false, null, false));

    const validError = await validateSongXML(payload);
    if (validError) {
        return {errors: validError};
    }

    return mygraphql(`
  mutation ($input: CreateCommitOnBranchInput!) {
    createCommitOnBranch(input: $input) {
      commit {
        url
      }
    }
  }
  `, {
        "input": {
            "branch": {
                "repositoryNameWithOwner": user + "/songbook",
                "branchName": branchName
            },
            "message": {
                "headline": msg.trim()
            },
            "fileChanges": {
                "additions": [
                    {
                        "path": file,
                        "contents": Buffer.from(payload).toString("base64")
                    }
                ]
            },
            "expectedHeadOid": branch.data.commit.sha
        }
    });
}

app.post('/users/:user/changes/:branchName[:]commit', async (req, res) => {
    const branchName = req.params.branchName;
    const msg = req.query.msg ? req.query.msg : "Kolejne zmiany";
    const file = req.query.file
    const payload = req.body;
    const commitResult = await commit(branchName, file, msg, payload, req, res);
    if (commitResult && commitResult.createCommitOnBranch) {
        res.send(
            {
                "status": "committed",
                "commit": commitResult.createCommitOnBranch.commit
            }
        );
        console.log(":commit over")
    } else {
        res.send(
            {
                "status": "failure",
                "errors": commitResult.errors
            }
        );
    }
});

app.post('/users/:user/changes/:branchName/:file([^$]+)', async (req, res) => {
    const branchName = req.params.branchName;
    const msg = req.query.msg ? req.query.msg.trim() : "Kolejne zmiany";
    const file = req.params.file.trim()
    const payload = req.body;
    const commitResult = await commit(branchName, file, msg, payload, req, res);
    if (commitResult && commitResult.createCommitOnBranch) {
        res.send(
            {
                "status": "committed",
                "commit": commitResult.createCommitOnBranch.commit
            }
        );
        console.log(":commit over")
    } else {
        res.send(
            {
                "status": "failure",
                "errors": commitResult.errors ? commitResult : "null"
            }
        );
        console.error(":commit failed", commitResult)
    }
});

app.post('/users/:user/changes/:branchName/:file([^$]+)[:]commitAndPublish', async (req, res) => {
    const branchName = req.params.branchName;
    const msg = req.query.msg ? req.query.msg : "Kolejne zmiany";
    const file = req.params.file.trim()
    const payload = req.body;
    await commit(branchName, file, msg, payload, req, res);
    return publish(res, req);
});

app.get('/users/:user/changes/:branchName/:file([^$]+)', async (req, res) => {
    try {
        const {octokit, user} = await newUserOctokit(req, res);
        if (!octokit) return;

        const branchName = req.params.branchName;
        console.log(branchName);
        let cont = await octokit.rest.repos.getContent(
            {owner: user, repo: 'songbook', path: req.params.file, ref: branchName});

        // res.setHeader('Content-disposition', 'attachment; filename='+req.params.file);
        res.setHeader('Content-type', 'text/xml')
        res.send(new Buffer.from(cont.data.content, "base64").toString('utf-8'));
    } catch (e) {
        if (e instanceof RequestError && e.status===404) {
            res.status(404);
            res.send("Document not found");
        } else {
            HandleError(e, res);
        }
    } finally {
        res.end();
    }
});

app.get('/pr0xy', async (req, res) => {
    let url = new URL(req.query.url);
    let protocol = url.protocol==="http" ? http_ : https_
    if (url.host==="spiewnik.wywrota.pl") {
        protocol.get(url, ans => {
            res.status(ans.statusCode);
            ans.on("data", chunk => {
                res.write(chunk)
            })
            ans.on("end", () => {
                res.end()
            })
            ans.on("close", () => {
                res.end()
            })
        })
    } else {
        res.status(400).send('Source not supported')
    }
})

app.get('/auth', async (req, res) => {
    clearCookiesAndAuthRedirect(res, CHANGES_BASE_URL);
});

app.get('/redirect', async (req, res) => {
    let red = req.cookies["redirectUrl"];
    console.log(`/redirect with REDIRECT URL: '${red}'`)
    console.log("Waiting for octokit")
    const {octokit} = await newUserOctokit(req, res);
    console.log("Waited for octokit")
    if (!octokit) {
        console.log("No octokit unfortunetely...");
        return
    }
    console.log("octokit got... Clearing/redirecting again:", red);
    res.clearCookie("redirectUrl");
    if (red && red.startsWith(REDIRECT_BASE_URL)) {
        console.log("Avoiding loop - going to: ", CHANGES_BASE_URL);
        res.redirect(CHANGES_BASE_URL);
    } else if (red &&  stripProtocol(red).startsWith(stripProtocol(BASE_URL))) {
        console.log("Internal our going there: ", red);
        res.redirect(red);
    } else {
        console.log("External URL: ", red, "vs:", BASE_URL, "Sending to /auth");
        res.redirect(AUTH_URL);
        // res.status(400);
        // res.send("No redirect with REDIRECT_BASE_URL");
    }
})

app.get('/intro', async (req, res) => {
    htmlPrefix(res);
    res.write(`
      <h1>O edytowaniu piosenek w śpiewniku</h1>
      <p>Zachęcamy wszystkich do poprawiania piosenek w naszym śpiewniku i dopisywania nowych.
      Staramy się, by było to jak najwygodniejsze, a rezultaty mogły być drukowane (PDF A4 i A5), czytane jako ebook 
      (EPUB) lub <a href="${EDITOR_DOMAIN}">przeglądane na stronie</a>.  
      Gdy twoje propozycje zmian zostaną zatwiedzone (dbamy o jakość), nowa wersja plików (wygenerowana w kilka minut)
      będzie zawierała te poprawki.
      </p>
      
      <p>Dlatego przygotowaliśmy narzędzie umożliwiające wygodne edytowanie piosenek i dodawanie ich do śpiewnika.
      Jedyny wymaganiem jest założenie bezpłatnego konta w serwisie <a href="https://github.com/">github</a>, 
      bo nasza baza piosenek jest przechowywana <a href="https://github.com/${GITHUB_OWNER}/songbook/tree/main/songs">właśnie tam</a>.
      </p>
      <p>Jeśli chcesz spróbować - <b>przejdź do <a href="/auth">edycji</a></b> – zostaniesz poproszony o zalogowanie lub przyznanie uprawnień naszej aplikacji.</p>
      
      <details>
        <summary>O bezpieczeństwie</summary>
        Możesz odczuwać uzasadniony dyskomfort (w szczególności jeśli masz swoje własne repozytoria githubowe),
        by upoważniać jakąś aplikację, by miała do nich dostęp. Mogę Cię tylko zapewnić (ale musisz mi zaufać),
        że ta aplikacja tylko: 
        <ul>
            <li>Tworzy roboczą kopię (fork) repozytorium <a href="https://github.com/${GITHUB_OWNER}/songbook">${GITHUB_OWNER}/songbook</a>, jeśli go jeszcze nie posiadasz.</li>
            <li>Dotyka wyłącznie Twojej roboczej kopi repozytorium 'songbook'</li>
            <li>Tworzy i kasuje gałęzie (branches) w repozytorium 'songbook' o nazwie zaczynającej się od 'se-'</li>
            <li>Tworzy zapisy (commits) w tych gałęziach, gdy zapisujesz zmiany piosenek.</li>
        </ul>
      </details>
      <details>
        <summary>Tryb samodzielny</summary>
         <p>Jeżeli chcesz użyć lub zapoznać się z samym edytorem piosenek, to przejdź do: <a href="${EDITOR_BASE_URL}">samodzielnego edytora</a>. 
         Będziesz mógł/mogła tworzyć nowe piosenki lub otwierać pliki z Twojego dysku lub je zapisywać do plików. Możesz wtedy je przesłać mailem
         lub samodzielnie użyć narzędzia 'git'.
      </p>
      </details> 
      <p>Problemy/uwagi możesz zgłaszać na: <a href="https://github.com/${GITHUB_OWNER}/songbook/issues">https://github.com/${GITHUB_OWNER}/songbook/issues</a></p>
      `);
    htmlSuffix(res);
});

console.info("Registering songbook", "baseUrl:" + BASE_URL);
http('songbook', app);
console.info("Registered songbook", "baseUrl:" + BASE_URL);
