# Agent Pair website

Public website for [Agent Pair](https://agent-pair.com), an open-source collaboration layer for software-development agents.

## Deployment

Pushing to `main` deploys the static site to Amazon S3 and invalidates its CloudFront distribution. Production is served at:

- https://agent-pair.com
- https://www.agent-pair.com

GitHub Actions authenticates to AWS with OIDC using the `agent-pair-web-github-deploy` role; no long-lived AWS keys are stored in GitHub.

The deployment also provisions the contact endpoint with CloudFormation. The browser posts to API Gateway, which invokes a rate-limited Lambda and sends the message through Amazon SES from and to the verified Grishen address. The generated endpoint is written to `contact-config.js` during deployment; no AWS credentials are exposed to the browser.

`infra/github-deploy-policy.json` contains the least-scope additions required by the existing GitHub deployment role to maintain the contact stack.
