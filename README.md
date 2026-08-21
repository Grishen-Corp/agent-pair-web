# Agent Pair website

Public website for [Agent Pair](https://agent-pair.com), an open-source collaboration layer for software-development agents.

## Deployment

Pushing to `main` deploys the static site to Amazon S3 and invalidates its CloudFront distribution. Production is served at:

- https://agent-pair.com
- https://www.agent-pair.com

GitHub Actions authenticates to AWS with OIDC using the `agent-pair-web-github-deploy` role; no long-lived AWS keys are stored in GitHub.
