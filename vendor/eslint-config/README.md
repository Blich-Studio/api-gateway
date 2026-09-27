# Bundled lint configuration

This is the JavaScript and type declarations from Blich Studio's MIT-licensed
`@blich-studio/eslint-config` 1.4.0 package, copied without rule changes.
Source: https://github.com/Blich-Studio/eslint-config/tree/a469328fb57181e7f09345cf1c3a576aab273140

The manifest uses these local file paths and omits publishing/build scripts.
Its public npm dependencies remain pinned by the service's Bun lockfile.
This avoids GitHub Packages billing and authentication being prerequisites
for service builds. No package-registry token is required.

To update: deliberately replace these files and the dependency declarations
from the reviewed upstream release, keep its MIT license, regenerate the
service lockfile, and run lint, typecheck, tests and a clean Docker build.
