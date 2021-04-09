import { startExploring } from "@jsenv/core"
import * as jsenvConfig from "../../jsenv.config.js"

startExploring({
  ...jsenvConfig,
  compileServerPort: 3472,
  explorableConfig: {
    "unit tests": {
      "test/**/*.test.html": true,
    },
  },
})
