*Documentation Version: 1.0*  
  
| Abbreviation | Meaning |  
|----------------|-------------------------------|-----------------------------|  
|`codebase` |The solution/EP-VMElement code |  
|`application` |The PR check loopback application  
  
# General  
  
- The checks are run only when a pull request is created or a commit is pushed to a branch for which a pull request is already present.  
  
- The `application` executes the checks for lint and test/code-coverage the same way a developers would run on their local workstation. Read section on *Lint Check* and *Test and it's coverage check* for details.  
- The `application` runs lint check for only the files that are modified in the PR, similarly only those `test_names` as mentioned in the PR description will be run and no other *tests* that may be present in the `codebase`'s test folder. *SCID JSON* for running the test will be picked from `SCID` folder at the root of the `codebase`. Reviewer discretion is required to verify that the code submitted is backed by appropriate testing.  
- Python linter used is *flake8* and lint rules are provided by [wemake python style guide]([https://github.com/wemake-services/wemake-python-styleguide](https://github.com/wemake-services/wemake-python-styleguide)). The rules set is thus a union of *flake8* default rules and those added by *wemake style guide*. Custom rules are specified through file `.flake8` located at the root of the `codebase`  
- PowerShell linter used in *PSScriptAnalyzer* and custom rules are specified through `.psLintRule.psm1` located at the root of the `codebase` currently.*  
- Linter custom rules and the Test-suite related files are considered to be locked files and only PR designated for such file modification should modify those files.  
- `tester.py` script **provides the single interface** for *creating test, running test and generating* the coverage report. Please read more about it on `test-suite` section below.
- High sensitivity to avoid any false positive.  
  
  
# Lint Check  
## Overview  
  
The Lint Check makes sure that the conventions as mentioned in the coding guideline are followed as well as complexity and general good coding standard were followed in the code being submitted in PR.  
  
A git diff between current branch head commit and the base branch is made to get the list of modified/added files. Of these files, only those ending with `.py` and `.psm1` are considered as Python and PowerShell files respectively. These files' path are checked against "`LINTTER_CHECK_OMITTED_PATHS`" environment variable and are filtered out if their path is listed as omitted path. The remaining files are checked for linting issues with the respective linters, using custom rule as defined in .flake8 and .psLintRule.psm1 located at the root of the `codebase`. *The check will fail unless all reported lint issues are fixed.*  
  
  
## Running lint check on local  
Running lint check locally is no different than how you would run the linter in absence of the `application`. Install the linter's dependencies as mentioned below and run linter as usual; the application does the same thing! The custom linter rules for Python and PowerShell linter are defined through files named - `.flake8` and `.psLintRule.psm1` respectively, both of which are present at the root of the `codebase`, They specify custom rules that override default rules.  
  
  
> *Note, both these files are among *`locked files`*, and no PR [except  
> a PR dedicated to modify these files] should do any modification to  
> these files. [**IMPORTANT**] Reviewer should not approve such a PR  
> having modification to locked files. The `LOCKED FILE MODIFICATION CHECK` will fail if such file/s modified.*  
  
> Most IDEs support on the fly lint check. See docs for the IDE you are using on how to configure on fly lint check while using the custom rules.*  
  
### Python  
Install **flake8**  
> `pip install flake8`  
  
Install **flake8 style guide plugin** **[wemake-python-styleguide]([[https://github.com/wemake-services/wemake-python-styleguide)**](https://github.com/wemake-services/wemake-python-styleguide)**](https://github.com/wemake-services/wemake-python-styleguide)**%5D(https://github.com/wemake-services/wemake-python-styleguide)**)) that out of box adds various standard lint rules to default flake8 rules.  
> `pip install wemake-python-styleguide`  
  
flake8 accepts customization defined in file named `.flake8` which is already defined and present at root of `codebase`.  
Run  
> `flake8 <filePath/folderPath>`  
  
when running the command from root of the `codebase`. Else, specify the custom rule path with --config parameter: `  
  
> flake8 --config <codebase/.flake8> <filePath/folderPath>`  
  
  
**The `application` runs all checks at the state of code at the commit HEAD.** This means, you may want to make sure to pull from the base branch before pushing and generating PR [which is also a general practice] **as the locked files may be modified at the base branch**. In such a case, the `locked file modification` check will fail even though you haven't modified those files- (pull from base branch in such a case and the check should pass).  
  
On Pull Request related events [creation/modifications], the application will checkout the HEAD commit, and then execute the command `flake8 --config <codebase/.flake8> <file_path>` and `Invoke-ScriptAnalyzer -Path <codebase/.psLintRule.psm1> <file_path>` for Python and PowerShell files respectively on the checked-out code.  
  
### PowerShell  
Install **PSScriptAnalyzer**  
command  
> Blockquote  
  
  
  
# Test Suite  
  
All test related code/files are currently under `codebase`/`<Plugin(S-Build)>/test` folder. A python script named `tester.py` to be used to run all test related commands for both Python and PowerShell and provide a single interface for creating tests, running test and generating the test coverage report. Both developers on their local and the `application` uses this script for any test related commands.  
  
  
### test/tester.py  
***Creating a test***  
  
> python tester.py create [--type | -t] <py | ps> [--name | -n]  
> <test_name>  
>  
Example:  
> python tester.py -t py -n configure_vlcm  
  
which will create a folder named "configure_vlcm" inside the `test/test_src` folder. Inside this folder, it will also create a folder named "data" (`test/test_src/configure_vlcm/data`) which is used to keep test related data files and a file named "test_configure_vlcm.py" (`test/test_src/configure_vlcm/test_configure_vlcm.py`). This is the test script file where the developer will be writing the code that simulate the task script. The max the simulation the max would be the test code coverage. The test file is also populated with a boilerplate code which provides a basic test code organized, various mock objects and the SCID file location.
  
  
***Running test/s***  
  
> python tester.py run <optional, many: --name | -n> <test_name> [optional: pytest arguments]  
  
Example:  
  
> python tester.py run -n configure_vlcm -n oneview  
> If test name is not provided, all test will be ran  
  
The SCID used for the test run will be taken from `codebase/SCID/xxx.json`  
The Run will also report code-coverage.



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