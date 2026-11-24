# Vercel limits for a fully static site (Hobby and Pro)

Read on 2026-11-24 UTC from the live Vercel pages. Scope: a Vite build output folder (HTML, JS, textures, binary 3D files, audio), no server code, deployed from a public GitHub repository.

Marks: `stated` means the statement is inside a quote kept below. `unknown` means no statement was found, and the row says what was tried.

## Table

| Limit | Hobby | Pro | What it counts | Source URL | Mark |
|---|---|---|---|---|---|
| "Static File uploads" (the 100 MB number) | 100 MB | 1 GB | Total size of the source files uploaded when deploying with the CLI. The quote names only that. It does not name build output, a single file, or Git deployments. | https://vercel.com/docs/limits#static-file-uploads | stated |
| Explicit sentence that the upload limit does or does not apply to Git deployments | not stated | not stated | The limit is worded only for "When using the CLI to deploy". No Vercel page says in so many words that Git deployments are exempt. Tried: limits, builds, git, cli/deploy, troubleshoot-a-build, error list. | https://vercel.com/docs/limits#static-file-uploads | unknown |
| Total size of build output or static files in one deployment | no cap stated | no cap stated | No per-deployment size cap for static output was found. Tried: limits, builds, configure-a-build, build-output-api, deployment-storage, error list, pricing. The nearest limits are Deployment Storage (below) and the 64 GB build disk. | https://vercel.com/docs/limits | unknown |
| Deployment Storage (team total) | 10 GB included. Going over can block new deployments | $0.10 per GB-month, no included cap stated | Build outputs and static assets of every retained deployment, added up across the team. Each new deployment of a large site adds its full output again. | https://vercel.com/pricing and https://vercel.com/changelog/hobby-projects-now-retain-fewer-deployments-to-free-up-storage and https://vercel.com/docs/deployment-storage | stated |
| Largest single static file | not stated | not stated | No maximum size for one static file in the build output was found. The build system report only flags files over 100 MB. A Vercel community reply mentions "100MB per file, 500MB total" for CLI uploads, but that is not in the documentation. Tried: limits, cdn-cache, build-output-api, error list, web search. | https://vercel.com/docs/deployments/troubleshoot-a-build | unknown |
| Number of source files | 15,000 | 15,000 | Source files uploaded in a CLI deployment. Use `--archive=tgz` to go over. | https://vercel.com/docs/limits#files | stated |
| Number of output files from a build | no upper limit | no upper limit | Files created by the build. Many thousands of files only slow the build. | https://vercel.com/docs/limits#files | stated |
| Build time | 45 minutes | 45 minutes | Duration of the Build Step per deployment. | https://vercel.com/docs/limits#build-time-per-deployment | stated |
| Build memory | 8 GB (8192 MB) | 8 GB, up to 60 GB | Memory of the build container. Hobby always uses the Basic machine. | https://vercel.com/docs/plans/hobby and https://vercel.com/docs/builds/managing-builds | stated |
| Build CPUs | 2 | 4, up to 30 | vCPUs of the build container. | https://vercel.com/docs/plans/hobby | stated |
| Build disk | 64 GB | 64 GB | Disk of the build container (repository checkout, node_modules, output). | https://vercel.com/docs/builds/managing-builds | stated |
| Build cache | 5 GB | 5 GB | Cache kept between builds, retained one month. | https://vercel.com/docs/limits#build-cache-maximum-size | stated |
| Concurrent builds | 1 | up to 500 | Builds running at once. | https://vercel.com/docs/builds/managing-builds | stated |
| Deployments per day | 100 | 6000 | Deployments created per day. | https://vercel.com/docs/limits#general-limits | stated |
| Routes per deployment | 2048 | 2048 | Each rewrite, redirect, or header rule in `vercel.json` counts as a route. | https://vercel.com/docs/limits#routes-created-per-deployment | stated |
| Data transfer per month (Fast Data Transfer) | first 100 GB included | Flat Rate CDN, included tier has 1 TB data transfer | Bytes sent between the CDN and visitors, full request and response size, cached or not. | https://vercel.com/docs/plans/hobby and https://vercel.com/docs/pricing/flat-rate-cdn | stated |
| CDN Requests per month | first 1,000,000 | Flat Rate CDN, included tier has 1M requests (the pricing markdown page says 10M, a conflict between Vercel pages) | Every request made to Vercel. | https://vercel.com/docs/plans/hobby and https://vercel.com/docs/pricing/flat-rate-cdn | stated |
| What happens over the included usage | paused, usually wait until 30 days have passed. Cannot buy more usage | not stopped, extra usage is billed on demand | Applies to the monthly included usage above. | https://vercel.com/docs/plans/hobby and https://vercel.com/docs/plans | stated |
| Fair use rule on media or file hosting | "Media hosting for hot-linking" is never fair use | same | Applies across plans. A site that loads its own textures, 3D files, and audio is a static site, which is listed as fair use. Serving media for other sites to hot-link is not. | https://vercel.com/docs/limits/fair-use-guidelines and https://vercel.com/legal/acceptable-use-policy | stated |
| Size or type cap on serving large media as static files | not stated | not stated | No cap on serving video, audio, or binary assets as static files was found. Docs only advise not packaging large videos into each deployment and suggest Vercel Blob. The old video hosting guide URL now redirects to the Blob docs. | https://vercel.com/docs/deployment-storage/optimize | unknown |
| CDN caching of static files | automatic, for the lifetime of the deployment, cannot be bypassed | same | Edge caching of files in the output folder. | https://vercel.com/docs/cdn-cache#static-files-caching | stated |
| Default `Cache-Control` header | `public, max-age=0, must-revalidate` | same | Default value on the Cache-Control page. That page does not say separately what plain static files receive. Custom values are set with `headers` in `vercel.json`. | https://vercel.com/docs/caching/cache-control-headers | stated |
| Automatic long browser cache for Vite hashed files under `/assets` | not stated | not stated | Only `/_next/static/immutable/` and `/_vercel/immutable/` are documented as served with a one year immutable header. Tried: cdn-cache, cache-control-headers, Vite framework page, vercel.json. | https://vercel.com/docs/cdn-cache#deleting-immutable-static-assets | unknown |
| Maximum cache time | 1 year | 1 year | `s-maxage`, `max-age`, `stale-while-revalidate`. The 10 MB cacheable response limit is worded for Vercel Function responses. | https://vercel.com/docs/cdn-cache#limits | stated |
| Commercial use | not allowed, personal or non-commercial use only | allowed (internal business or personal purposes) | Terms of Service, section 4 and section 2. | https://vercel.com/legal/terms | stated |
| Definition of "commercial" for Hobby | not stated | n/a | The fair use page and the Hobby plan page no longer contain a commercial usage section. Checked the rendered pages and their markdown versions for the word "commercial". | https://vercel.com/docs/limits/fair-use-guidelines | unknown |
| Removal of Hobby deployments by Vercel | may be disabled or removed with or without notice | not stated | Terms of Service, section 4. | https://vercel.com/legal/terms | stated |
| Git repository rules | cannot connect repositories owned by a Git organization. Commit author must be the Hobby team owner | commit author must be a team member (private repositories) | Connecting and deploying from Git. For a public repository in a personal GitHub account these do not block the owner. | https://vercel.com/docs/limits#connecting-a-project-to-a-git-repository and https://vercel.com/docs/git | stated |
| Default deployment retention | 30 days, keeps last 3 deployments and last 3 production deployments | 30 days, keeps last 10 and last 20 | How long old deployments (and their storage) are kept. | https://vercel.com/docs/deployment-retention | stated |

## Quotes by page

### https://vercel.com/docs/limits (last updated September 16, 2026)

- General limits table row, columns Hobby, Pro, Enterprise: "Static File uploads|100 MB|1 GB|N/A"
- "When using the CLI to deploy, the maximum size of the source files that can be uploaded is limited to 100 MB for Hobby and 1 GB for Pro. If the size of the source files exceeds this limit, the deployment will fail."
- "The maximum number of files that can be uploaded when creating a CLI Deployment is `15,000` for source files. If you upload more files than the limit, Vercel rejects the request and does not create the deployment. To deploy more files, use the `--archive=tgz` option."
- "Although there is no upper limit for output files created during a build, you can expect longer build times as a result of having many thousands of output files (100,000 or more, for example). If the build time exceeds 45 minutes then the build will fail."
- "The maximum duration of the Build Step is 45 minutes. When the limit is reached, the Build Step will be interrupted and the Deployment will fail."
- "The maximum size of the build cache is 5 GB for every build machine type, including Elastic build machines."
- General limits table rows: "Deployments Created per Day|100|6000|Custom", "Routes created per Deployment|2048|2048|Custom", "Build Time per Deployment (Minutes)|45|45|45", "Disk Size (GB)|64|64|64", "Concurrent Deployments|1|Up to 500*|Custom"
- "If you are using a `vercel.json` configuration file, each rewrite, redirect, or header is counted as a Route"
- "Vercel does not support connecting a project on your Hobby team to Git repositories owned by Git organizations. You can either switch to an existing Team or create a new one."
- "Using Next.js or any similar framework to build your deployment is classed as a build. Each Vercel Function is also classed as a build. Hosting static files such as an index.html file is not classed as a build."

### https://vercel.com/docs/plans/hobby (last updated November 12, 2026)

- Included usage table rows: "Fast Data Transfer|First 100 GB" and "CDN Requests|First 1,000,000"
- "As the Hobby plan is a free tier there are no billing cycles. In most cases, if you exceed your usage limits on the Hobby plan, you will have to wait until 30 days have passed before you can use the feature again."
- Comparison table rows, columns Hobby and Pro: "Build vCPUs|2|4, up to 30", "Build memory (GB)|8|8GB, up to 60GB", "Build disk size|64 GB|64 GB (all build machine types)", "Deployments per day|100|6,000"

### https://vercel.com/docs/plans

- "Hobby plans will be paused when they exceed the included free tier usage"
- "For Pro and Enterprise teams, when you reach 100% usage your deployments are not automatically stopped. Rather, Vercel enables you to incur on-demand usage as your site grows."

### https://vercel.com/docs/limits/fair-use-guidelines (last updated November 12, 2026)

- "Vercel usage is subject to these fair use guidelines across plans and usage-based resources."
- List under "Examples of fair use": "Static sites", "Hybrid apps", "Frontend apps", "Single page applications"
- List under "Never fair use": "Proxies and VPNs", "Media hosting for hot-linking", "Scrapers", "Crypto Mining"
- "As a guideline for our community, we expect most users to fall within the below ranges for each plan. These guidelines are not Pro plan entitlements; Vercel bills Pro usage through included credit and on-demand rates. We will notify you if your usage is an outlier."
- Typical monthly usage table row, columns Resource, Included (Pro), Included (Hobby): "Fast Data Transfer | Flat Rate CDN | First 100 GB"
- The two lists (fair use examples and never fair use) appear only on the rendered page. The markdown version of the page shows those two headings with no items under them.
- "Circumventing or otherwise misusing Vercel's limits or usage guidelines is a violation of our fair use guidelines."
- Not on the page: the word "commercial" does not appear in the rendered page or in its markdown version.

### https://vercel.com/legal/acceptable-use-policy (last updated April 21, 2026)

- In the list of things customers may not do: "Scrape, proxy, act as a VPN, or host media for hot-linking;"
- "Create an undue burden on Vercel’s or third party’s websites, infrastructure, services or networks;"

### https://vercel.com/legal/terms (last updated October 19, 2026)

- Section 4, Hobby Plan: "You shall only use the Services under a Hobby plan for your personal or non-commercial use."
- Section 4: "We reserve the right to disable or remove any Project or website deployment on the Hobby plan with or without notice at our sole discretion."
- Section 2: "you are granted a personal, non-sublicensable, non-exclusive, non-transferable, limited license, to use the Services for your internal business or personal purposes according to the service capacity of your account."
- Section 3: "In addition, if you are on a Hobby plan or trial Pro plan, you agree that we may use Your Content to train our artificial intelligence (“AI”) and machine learning models"
- Section 12: "you acknowledge that Vercel may establish general practices and limits concerning use of the Services, including without limitation the maximum period of time that data, code or other content will be retained by the Services, the maximum storage space that will be allotted on Vercel's servers on your behalf, and the maximum compute capacity provided for the execution of builds and functions and the maximum network data transferred by the Services."

### https://vercel.com/pricing

- Deployments section, columns Hobby, Pro, Enterprise: "Deployment Storage", "10 GB included", "$0.10 per GB-month", "Custom"
- Delivery Network section, Hobby then Pro: "Fast Data Transfer", "100 GB / month included", "Included in Flat Rate CDN"
- Delivery Network section, Hobby then Pro: "CDN Requests", "1M / month included", "Included in Flat Rate CDN"
- Build minutes, Hobby then Pro: "Basic machines", "Included", "$0.007 per minute"
- FAQ: "If you have a free Hobby account, you are limited to the usage caps and cannot purchase additional usage."
- FAQ: "Requests to static assets incur the same Fast Data Transfer usage if the response is cached or uncached."
- Note: the markdown version at https://vercel.com/pricing.md shows different Pro cells: "1TB / month included; then starting at $0.15 per GB" for Fast Data Transfer and "10M / month included; then starting at $2 per 1M" for CDN Requests.

### https://vercel.com/docs/pricing/flat-rate-cdn

- "Each tier is a fixed monthly price for a monthly request and data transfer capacity. Pro includes the lowest tier at no additional cost."
- Tier table row, columns Tier pricing, CDN requests, Data transfer: "Included with Pro | 1M | 1 TB"
- "If your total usage for a billing cycle exceeds your monthly capacity, Vercel moves you to a higher tier at the start of the next cycle. Occasional spikes don't trigger an upgrade."

### https://vercel.com/docs/plans/pro-plan

- "Monthly credit: Every Pro plan has $20 in monthly credit."
- "Flat Rate CDN: Pro includes the lowest capacity tier at no extra cost, with a capacity of 1 million CDN requests and 1 TB of data transfer each month."

### https://vercel.com/docs/manage-cdn-usage

- "When a user visits your site, the data transfer between Vercel's CDN and the user's device gets measured as Fast Data Transfer. The data transferred gets measured based on data volume transferred, and can include assets such as your homepage, images, and other static files."
- "Fast Data Transfer is calculated based on the full size of each HTTP request and response transmitted to or from Vercel's CDN. This includes the body, all headers, the full URL and any compression."

### https://vercel.com/docs/deployment-storage (last updated August 21, 2026)

- "Deployment Storage is cloud storage for the build output and Vercel Function bundles retained with your deployments."
- Table row, columns Usage metric and What it includes: "Deployment Storage | Build outputs and static assets"
- Table row, columns Driver and Effect on usage: "Output size | Larger assets or Function bundles add more storage per deployment."
- Table row, columns Usage metric and Pro list price: "Deployment Storage | $0.10 per GB-month"

### https://vercel.com/changelog/hobby-projects-now-retain-fewer-deployments-to-free-up-storage (published September 16, 2026)

- "Hobby teams get 10GB of Deployment Storage. Every deployment you keep uses some of it, and going over the limit can block you from deploying until you free some up."
- "Each Hobby project now keeps its 3 most recent production deployments, plus its 3 most recent deployments of any type, regardless of age."
- "If your team is over the 10GB limit, deployments outside those exceptions are now deleted immediately instead of after 30 days."

### https://vercel.com/changelog/deployment-storage-keeps-your-deployments-rollback-ready (published August 21, 2026)

- "Deployment Storage is billed at $0.10 per GB per month"
- "Hobby teams include up to 10 GB"
- "Keep future deployments smaller by trimming your output directory, moving large files to Vercel Blob, and reducing Function bundle size"

### https://vercel.com/docs/deployment-storage/optimize (last updated August 21, 2026)

- "Do not package large videos, archives, or changing data exports into each deployment when the application can load them from separate storage."
- "Keep only the files required to serve the application. Do not set an entire repository or a broad build workspace as the Output Directory."

### https://vercel.com/docs/deployment-retention (last updated September 16, 2026)

- Default retention table row, columns Plan, Canceled, Errored, Pre-Production, Production: "Hobby and Pro | 30 days | 30 days | 30 days | 30 days"
- Exceptions table rows, columns Exception, Hobby, Pro and Enterprise: "Last deployments created in the project | Last 3 | Last 10" and "Production deployments in state Ready | Last 3 | Last 20"

### https://vercel.com/docs/builds (last updated September 3, 2026)

- "Build timeout: The maximum build time is 45 minutes. If your build exceeds this limit, it will be terminated, and the deployment fails."
- Container resources table, columns Hobby, Pro, Enterprise: "Memory|8192 MB|8192 MB|Custom", "Disk Space|64 GB|64 GB|64 GB", "CPUs|2|4|Custom"
- "Vercel uploads your build artifacts (static files, Vercel Functions, and other assets) to the CDN."
- "By default, Vercel performs a shallow clone of your repo (`git clone --depth=10`) to speed up build times." (the page sets "shallow clone" in italics)

### https://vercel.com/docs/builds/managing-builds (last updated September 17, 2026)

- "Hobby teams always use the Basic build machine. Basic has 2 vCPUs and 8 GB of memory."
- Build machine table rows, columns type, vCPUs, Memory (GB), Disk size (GB): "Basic|2|8|64", "Standard|4|8|64", "Turbo|30|60|64"
- "Hobby: 1 concurrent deployment. Builds beyond this run sequentially."

### https://vercel.com/docs/deployments/troubleshoot-a-build (last updated September 21, 2026)

- "This report helps you detect hidden Out of Memory (OOM) events, and provides insights into disk usage by breaking down the sizes of your source code, `node_modules`, and output, and flagging files over 100 MB. The input size in the report corresponds to the size of your checked-out repository or files uploaded by CLI."
- Resource table rows: "Memory|Varies|Depends on the build machine type. Builds exceeding this limit will be cancelled" and "Disk Space|Varies|Depends on the build machine type. Builds exceeding this limit will be cancelled"

### https://vercel.com/docs/cdn-cache

- "Static files are automatically cached on Vercel's global network for the lifetime of the deployment after the first request."
- "If a static file is unchanged, the cached value can persist across deployments due to the hash used in the filename"
- "Vercel doesn't allow bypassing the cache for static files by design."
- "Immutable static assets are files under `/_next/static/immutable/` and `/_vercel/immutable/`. They are content-addressed, and Vercel serves them with `Cache-Control: public, max-age=31536000, immutable`."
- "The following caching limits apply to Vercel Function responses:" followed by "Max cacheable response size: 10MB" and "Max cache time: 1 year"

### https://vercel.com/docs/caching/cache-control-headers (last updated September 14, 2026)

- "The default value is `cache-control: public, max-age=0, must-revalidate` which instructs both the CDN and the browser not to cache."
- Recommended settings table row: "Immutable static assets (hashed JS, CSS, fonts) | `max-age=31536000, immutable` | Content-hashed assets. Frameworks like Next.js set this automatically."
- "Custom headers can be configured with the `headers` property in `next.config.js` for Next.js projects, or it can be configured in `vercel.json` for all other projects."

### https://vercel.com/docs/project-configuration/vercel-json

- "The following example adds `Cache-Control` headers to the favicon and other static assets:" (the example sets `"src": "/assets/(.*)"` with `"Cache-Control": "public, max-age=31556952, immutable"`)

### https://vercel.com/docs/git

- "You cannot deploy to a Hobby team from a private repository in a GitHub organization, GitLab group, or Bitbucket workspace. Consider making the repository public or upgrading to Pro."
- "To deploy commits under a Hobby team, the commit author must be the owner of the Hobby team containing the Vercel project connected to the Git repository."
- "When a public repository is forked, commits from it will usually deploy automatically. However, when you receive a pull request from a fork of your repository, Vercel will require authorization from you or a team member to deploy the pull request."

### https://vercel.com/docs/cli/deploy

- "This optimization supports deployments containing HTML, Markdown, and other static assets, with up to 100 files and a total size of up to 25 MB." (this is only a rule for skipping the build step on small CLI deployments, not a size limit)
- "The `--archive` option compresses the deployment code into one or more files before uploading it. This option should be used when deployments include thousands of files to avoid rate limits such as the files limit."

### https://vercel.com/docs/drop

- "Without an account, you can only drop static sites. Each file can be up to 100 MB, and the whole drop up to 1 GB." (this applies to drag and drop without an account, not to Git deployments)

### https://vercel.com/docs/vercel-blob

- Use cases list: "Large files such as video and audio to take advantage of the global network"
- "Cost-optimized for large assets: 3x more cost-efficient than Fast Data Transfer on average"
- Note: https://vercel.com/kb/guide/best-practices-for-hosting-videos-on-vercel-nextjs-mp4-gif now answers with a 308 redirect to this page, so the old video hosting guide is no longer live.

### Not official documentation, kept only as a pointer

- https://community.vercel.com/t/auto-deployment-and-webhooks-doesnt-work-github-and-cursor/28445 has a forum reply about a CLI "Invalid file size" error that says "Your project has files that exceed Vercel’s limits (100MB per file, 500MB total)". These two numbers do not appear on any Vercel documentation page read here, so they stay `unknown`.

## Answer to the main question

The 100 MB number on Hobby (1 GB on Pro) is named "Static File uploads" and the documentation defines it as the maximum total size of the source files uploaded when you deploy with the Vercel CLI. The documentation does not describe it as a limit on the build output, on a single file, or on the size of a deployment. It words the limit only for CLI deployments and gives no such number for deployments built from Git, where Vercel clones the repository into a build container with 64 GB of disk, although no page says in so many words that Git deployments are exempt. For a large static site built from Git the limits that are actually stated are: 45 minutes of build time, 8 GB of build memory and 64 GB of build disk, 10 GB of Deployment Storage on Hobby counted across all retained deployments (going over can block new deployments), 100 GB of Fast Data Transfer and 1 million CDN requests per month on Hobby (the project is paused when exceeded), the fair use rule against media hosting for hot-linking, and the Hobby rule of personal or non-commercial use only. A maximum size for one static file and a total output size per deployment are not stated anywhere in the pages read.
