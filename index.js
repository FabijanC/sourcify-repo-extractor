const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const AdmZip = require('adm-zip');
const path = require('path');
const fetch = require('node-fetch');

const port = 3000 || process.env.PORT;

const app = express();
app.use(bodyParser.urlencoded({ extended: true }));

app.get('/', (req, res) => {
    console.log("Root visited.");
    console.log("TODO: provide a website with a form");
    res.sendStatus(200);
});

/**
 * Function that sends HTTP code 400 with the provided message if the provided dirPath is not an existing directory.
 * 
 * @param {*} dirPath path to the directory whose existence should be checked
 * @param {*} msg Message to send with status code 400
 * @param {*} res Response object
 * 
 * @returns true if dirPath is an existing direcotry, false otherwise
 */
function checkDir(dirPath, msg, res, dirToDelete) {
    if (!fs.existsSync(dirPath) || !fs.lstatSync(dirPath).isDirectory()) {
        res.status(400);
        res.send(msg);
        fs.rmdirSync(dirToDelete, { recursive: true });
        return false;
    }
    return true;
}

app.post('/extract', async (req, mainRes) => {
    if (!req.body.url) {
        mainRes.status(400);
        mainRes.send("Request missing url parameter.");
        return;
    }

    let receivedUrl = req.body.url.trim();
    console.log("Received url:", receivedUrl);

    if (!receivedUrl.startsWith("https://github.com") && !receivedUrl.startsWith("http://github.com")) {
        mainRes.status(400);
        mainRes.send("Not a valid github.com URL.");
        return;
    }

    let repoUrl = receivedUrl;
    if (!repoUrl.endsWith(".zip") && !repoUrl.endsWith("zipball/master")) {
        repoUrl = repoUrl.replace(/\/*$/, ""); // strip trailing slashes
        repoUrl = repoUrl + "/zipball/master"; // concatenate the zipping suffix
    }

    let downloadSuccessful = false;
    let zip;
    const urlOptions = [receivedUrl, repoUrl];
    for (let i = 0; i < urlOptions.length; ++i) {
        const response = await fetch(urlOptions[i]);
        const zipBuffer = await response.buffer();
        try {
            zip = new AdmZip(zipBuffer);
            downloadSuccessful = true;
            console.log("Downloaded from:", urlOptions[i])
            break;
        } catch (err) { }
    }

    if (!downloadSuccessful) {
        console.log("Illegal URL");
        mainRes.status(400);
        mainRes.send("Provide either a URL to a .zip file or to a valid repo page.");
        return;
    }


    const timestamp = Date.now().toString();
    const TMP_DIR = `tmp_${timestamp}`;
    zip.extractAllTo(TMP_DIR);

    const projectRootContent = fs.readdirSync(TMP_DIR);
    if (projectRootContent.length !== 1) {
        mainRes.status(400);
        mainRes.send();

        return;
    }
    const projectName = fs.readdirSync(TMP_DIR)[0];
    const projectPath = path.resolve(TMP_DIR, projectName);

    const buildPath = path.resolve(projectPath, "build");
    if (!checkDir(buildPath, "No build/ directory", mainRes, TMP_DIR)) {
        return;
    }

    const buildContractsPath = path.resolve(buildPath, "contracts");
    if (!checkDir(buildPath, "No build/contracts/ directory.", mainRes, TMP_DIR)) {
        return;
    }
    const buildContracts = fs.readdirSync(buildContractsPath);

    const contractsFolderPath = path.resolve(projectPath, "contracts");
    if (!checkDir(contractsFolderPath, "No contracts/ directory.", mainRes, TMP_DIR)) {
        return;
    }
    const contractsFolder = fs.readdirSync(contractsFolderPath);

    const missingJson = [];
    let atLeastOneSol = false;
    for (let i = 0; i < contractsFolder.length; ++i) {
        const contractName = contractsFolder[i];
        if (!contractName.endsWith(".sol")) {
            continue;
        }

        atLeastOneSol = true;

        const jsonCounterpart = contractName.replace(/\.sol$/, ".json");
        if (buildContracts.indexOf(jsonCounterpart) === -1) {
            missingJson.push(jsonCounterpart);
        }
    }

    if (!atLeastOneSol) {
        mainRes.status(400);
        mainRes.send("No .sol files provided.");
        fs.rmdirSync(TMP_DIR, { recursive: true });
        return;
    }

    if (missingJson.length) {
        mainRes.status(400);
        mainRes.send(`Missing files [${missingJson}] in build/contracts/ directory.`);
        fs.rmdirSync(TMP_DIR, { recursive: true });
        return;
    }

    // TODO do something with the checked files

    fs.rmdirSync(TMP_DIR, { recursive: true });

    mainRes.status(200);
    mainRes.send(`Successfully checked ${projectName}.`);

})

app.listen(port, () => {
    console.log("Listening on port:", port);
});