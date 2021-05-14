## Setting up the applicaiton
#### _1._ Clone the repository -> 'cd' into the repository folder thus created and then run all below commands.
#### _1 (a)._ Make sure you have a `.env` file at the root of the cloned project with all the keys mentioned in `env_template.txt` set. `.env` is put into `.gitignore` and so it's not part of the repository. App may fail to start if expected enviornment variables are not set.
#### _2._ Build the docker image: `npm run docker:build` OR `npm run docker:build-dev` for development enablement. More information about development given in below sections.
#### _3._ Create and run container from the image: `npm run docker:run` OR `npm run docker:run-dev` to start container with development enablement

### Only if development:-
#### _4._ Go inside the container: `docker exec -it pr-checks bash`
#### _5._ Install dependencies: `npm i`
#### _6 (a)._ Run the application: `npm start`
#### _6 (b)._ Or, Run the application with debugger started [listening on port `9229`]: `npm run start:debug`
#### 7. Provide on prompt- your github personal access token (github PAT) and your github username
