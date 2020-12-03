import { reportFileSizeImpact, raw, gzip, brotli, readGithubWorkflowEnv } from "../../../index.js"

reportFileSizeImpact({
  ...readGithubWorkflowEnv(),
  logLevel: "debug",
  buildCommand: "npm run dist",
  trackingConfig: {
    src: {
      "./src/**/*.js": true,
    },
  },
  transformations: { raw },
})
