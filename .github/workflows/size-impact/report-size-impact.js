import { reportFileSizeImpact, raw, readGithubWorkflowEnv } from "@jsenv/file-size-impact"

reportFileSizeImpact({
  ...readGithubWorkflowEnv(),
  buildCommand: "npm run dist",
  trackingConfig: {
    src: {
      "./src/**/*.js": true,
    },
  },
  transformations: { raw },
})
