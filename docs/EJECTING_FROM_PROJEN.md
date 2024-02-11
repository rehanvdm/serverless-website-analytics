# No Projen and JSII

This project used to use Projen which is a wrapper for JSII. I have since removed it because it is difficult to have
a large application and source code also in TS that has different TS requirements. JSII generates a tsconfig file
and does not support a modern configuration. There are some predefined escape hatches to override this behaviour but
it is still lacking.

Example of the JSII tsconfig.json:
```json
{
  "compilerOptions": {
    "module": "CommonJS",
    "target": "ES2020",
    "lib": [
      "es2020"
    ]
  }
}
```

Example of the tsconfig.json that I want/need:
```json
{
  "compilerOptions": {
    "module": "ESNext",
    "target": "ESNext",
    "lib": [
      "ESNext"
    ],
    "paths": {
      "@infra/*": ["infra/*"],
      "@backend/*": ["application/src/backend/*"],
      "@frontend/*": ["application/src/frontend/*"],
      "@tests/*": ["tests/*"]
    }
  }
}
```

It does not have to be the absolute latest target and lib, but it should be at least enough to satisfy the needs of
`Vite` which uses functions like `import.meta.XXX`. There might have been a way to override it but it feels like fighting
the system. The same goes with the `paths` configuration, it is not supported by JSII and I can understand why. It is
notoriously difficult to get right and I had to even do string replacements in the `tsc` for this project to work.

All in all, having to support two different TS configurations is not worth it. I had constant issues with ESLint,
especially when trying to reference code from the application directory in the infra directory. There would be constant
issues.

The straw that broke the camel's back was [this](https://typescript-eslint.io/linting/troubleshooting/#i-get-errors-telling-me-eslint-was-configured-to-run--however-that-tsconfig-does-not--none-of-those-tsconfigs-include-this-file)
ESLint issue that I just could not get fixed.

There are of course downsides of ejecting out of Projen, the main one being that it deviates from the "standard" and has
things like different build scripts etc.

There are currently no plans to support other languages than TypeScript, so the need for JSII is not there. It is a
pretty bold decision but most of CDK usage is synonymous with TypeScript. So far we have not had any request for other
language support and I do not see that changing in the near future.
