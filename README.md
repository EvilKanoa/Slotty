# Slotty
Online web app designed to help you get a slot in that hard to register for course!

If you want to just use the app, skip down to the **Deploying** section.

If you want to help develop or play around with the code, visit the **Developing** section.

For random questions you may have, take a look at the **FAQ** section.

## FAQ

#### Q: What is the purpose of all these files?

TODO

#### Q: How do you persist (store) data?

Short answer: PostgreSQL Database

Long answer: TODO

#### Q: What framework is used on the frontend?

Short answer: None

Long answer: TODO

#### Q: What framework is used on the backend?

Short answer: None (libraries used incl. `express` and `node-postgres`)

Long answer: TODO

## Configuration

TODO

## Developing
### 1. Prerequisites
* [Node 12+](https://nodejs.org/en/) (may function with older versions at your own risk)
* [Yarn](https://yarnpkg.com/en/)
* An editor of your choice
  * Recommended: [VS Code](https://code.visualstudio.com)
  * Recommended: [WebStorm](https://code.visualstudio.com)
  * Recommended: [Sublime Text](https://www.sublimetext.com)
  * Alternative: [Notepad++](https://notepad-plus-plus.org)
  * Alternative: Vim
  * Alternative: [Eclipse](https://www.eclipse.org)
* Git client of your choice
  * Recommended: [Command line client](https://git-scm.com)
  * Alternative: [Sourcetree](https://www.sourcetreeapp.com)
  * Alternative: [GitHub Desktop](https://desktop.github.com)

### 2. Installing

1. Ensure the required prerequisites are installed. In particular, you should be able to run `node -v` on the command line and see a version at 12 or over outputted. As well, you should be able to run `yarn -v` and see a version outputted.
2. Clone the repository using your client of choice. If you're using the command line client, you should be able to execute `git clone git@github.com:EvilKanoa/Slotty.git` or `git clone https://github.com/EvilKanoa/Slotty.git`.
3. Navigate a command line into the newly cloned `Slotty` folder and install the required libraries by running `yarn`.
4. Open the `config.json` file and ensure that the configuration values look correct.
5. Done!

### 3. Running

1. Open a command line within the Slotty folder and run `yarn start` to run the development server.
2. The server will now be available on your local machine at the port specified within `config.json`. That is, if `port = 8080` (the default value), then you can navigate to `http://localhost:8080` or `http://127.0.0.1:8080` in a browser to access the site.
3. For testing the backend, Postman is recommended.
4. Once changes have been made, run `yarn lint` before committing or pushing your changes.

## Deploying

To deploy Slotty, simply follow steps 1 and 2 of developing and then start the application using `yarn prod`.
