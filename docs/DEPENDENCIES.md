# Dependencies

Dependencies are being updated manually until automated tests have been set up.

```shell
npm install -g npm-check-updates
ncu
ncu - u
```

## Pinned dependencies

- `execa` use v5, needs to stay CJS
- `p-limit` use v3, need to stay CJS
- `@types/node` keep same as Node Engine `v18.19.1`
- `semantic-release` keep on v22 because we need to support Node Engine > v18
- `chai` use v4, needs to stay CJS, else we get an error when mocha runs, complains about ESM, not obvious

## How to update dependencies

### Project `pakcage.json`
1. Run `ncu` and have a look at what can be updated, pay attention to major versions
2. Run `ncu -u` to update `package.json`
3. Change the pinned versions above back to what they were
4. Run
  ```shell
  npm run lint-fix
  npm run build
  npm run validate
  ```
5. Run a few tests to see if everything still works

### Frontend `application/src/frontend/pakcage.json`
3. Run
  ```shell
  cd application/src/frontend/
  ```
1. Run `ncu` and have a look at what can be updated, pay attention to major versions
2. Run `ncu -u` to update `package.json`
3. Run and manually verify if the frontend still seems fine
  ```shell
  npm run build
  npm run dev
  ```
