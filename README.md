Simple server that checks if a GitHub repo is a valid Solidity project. The server has one endpoint at /extract which expects a POST request with a url parameter. Provide a URL to the GitHub page of your repo, e.g. https://github.com/sourcifyeth/example-truffle-project-zip. A direct link to a zipped file is also acceptable. The repo should contain a contracts/ and a build/contracts directory with matching .json and .sol files. If everything is correct, a 200 code is returned; otherwise a 400 is returned with an appropriate message.

# Usage

curl -d url=https://github.com/sourcifyeth/example-truffle-project-zip localhost:3000/extract