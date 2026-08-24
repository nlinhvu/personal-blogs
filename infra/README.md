# Infrastructure

OpenTofu 1.12.6, provider `cloudflare/cloudflare` 5.23.0.
Remote state: Cloudflare R2 through the S3-compatible backend.

## Ownership boundary

OpenTofu owns: zone, zone settings, DNSSEC, CAA, R2 bucket, `workers_custom_domain`.
Wrangler owns: the Worker script content.
Nobody owns Web Analytics; see Known manual exceptions.

OpenTofu must never manage `cloudflare_workers_script`. Wrangler redeploys it
constantly, so OpenTofu would report drift on every plan.

## Environment variables required

```text
CLOUDFLARE_API_TOKEN            # Cloudflare API token, scoped to one account
TF_VAR_cloudflare_account_id    # prod account id
AWS_ACCESS_KEY_ID               # R2 access key id  (backend only)
AWS_SECRET_ACCESS_KEY           # R2 secret         (backend only)
```

The two `AWS_*` names are what the S3 backend reads. They hold R2 credentials,
not AWS ones.

## API token permissions

Two credentials, deliberately separate (ADR-0007). The Cloudflare API token
never touches state; the R2 key never touches Cloudflare resources.

### `cf-prod-infra` — Cloudflare API token

| Group | Permission | Used for |
|---|---|---|
| Zone | Zone / Edit | create the zone |
| Zone | Zone Settings / Edit | ssl, always_use_https, automatic_https_rewrites, min_tls_version, tls_1_3 |
| Zone | DNS / Edit | the apex record the custom domain creates |
| Account | Workers Scripts / Edit | bind a Worker to a hostname |
Zone Resources must be **All zones from an account**, not a single zone: a
zone-scoped token cannot create a zone, because the zone does not exist yet to
scope to. Narrow it to the specific zone later if the token is ever reissued.

### `r2-state` — R2 API token (S3-compatible)

Object Read & Write, restricted to the `vulinh-tofu-state` bucket. Exported as
`AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY`. R2 tokens scope per bucket, not
per key prefix, so this one credential reaches every environment's state. Only
the infrastructure pipeline holds it, and that pipeline sits behind an approval
gate.

## State locking

`use_lockfile = true` relies on S3 conditional writes (`If-None-Match`).

Verified against R2 on `2026-08-23`: **WORKS**. Keep `use_lockfile = true`.

Two concurrent `tofu plan -lock-timeout=0` runs were launched against this
module. The second one was refused:

```text
Error: Error acquiring the state lock

Error message: operation error S3: PutObject, https response error
StatusCode: 412, api error PreconditionFailed: At least one of the
pre-conditions you specified did not hold.
```

HTTP 412 on `PutObject` is the conditional write (`If-None-Match`) doing its
job: the lock object already existed, so R2 rejected the second writer. This
closes Open Question #1 in the Phase 1 design.

Re-run that check after any backend change. If it ever stops working, remove
`use_lockfile = true` and record the limitation here with the date.

## Bootstrap

`infra/bootstrap` creates the R2 bucket that holds all remote state. It is a
chicken-and-egg module: it cannot store its state in the bucket it has not
created yet.

**Current state: bootstrapped.** The bucket exists, `backend.tf` is active, and
this module keeps its own state at `bootstrap/terraform.tfstate` inside that
bucket. Clone the repo and `tofu init` connects straight to R2 — no special
steps.

Do not run `tofu destroy` here. The bucket resource carries `prevent_destroy`,
and destroying it would delete the state that describes it.

### How it was bootstrapped

Kept as a recipe for rebuilding this from nothing, in a new account or after a
disaster. It is not part of normal operation.

The backend block starts life as `backend.tf.disabled` so that the first apply
runs against local state:

```bash
cd infra/bootstrap
tofu init                      # local state, no backend block present
tofu apply                     # creates the bucket
mv backend.tf.disabled backend.tf
tofu init -migrate-state       # answer: yes
tofu plan                      # expect: No changes.
rm -f terraform.tfstate terraform.tfstate.backup
tofu plan                      # expect: No changes. -- proves state reads from R2
```

## Known manual exceptions

Things that are configured in the Cloudflare dashboard and deliberately not in
this state. Each one needs a replacement check, because a setting nobody
declares is a setting nobody notices changing.

### Cloudflare Web Analytics

**Enabled in the dashboard on 2026-08-23. Not managed here, and not for lack of
trying.**

`cloudflare_web_analytics_site` exists in provider 5.23.0 and the site was
declared with an `import` block matching the live values exactly, so the apply
would have written nothing. It still failed, on the import's own read:

```text
GET https://api.cloudflare.com/client/v4/accounts/<account>/rum/site_info/<site>
403 Forbidden
{"code":10000,"message":"Authentication error"}
Planning failed.
```

Granting **Account Analytics** to the token did not change it. That permission
group covers analytics *data*; the `/rum/site_info/*` endpoints are Web
Analytics *administration* and are not reachable from an account API token of
the kind this pipeline uses. Cloudflare documents neither the requirement nor
the gap.

Two rounds of permission work bought nothing, so the resource was removed. What
it was ever going to provide was drift detection on one boolean, and a smoke
test provides that for free — the beacon either reaches a reader or it does not,
which is the thing actually worth knowing:

```bash
curl -sS https://vulinh.dev/ -H 'Accept: text/html' \
  | grep -qE '<script[^>]*static\.cloudflareinsights\.com'
```

That runs in the `Smoke test production` step of `.github/workflows/site-deploy.yml`.
Two details are load-bearing, and both were measured against production rather
than assumed:

| Detail | Why |
|---|---|
| `Accept: text/html` | Cloudflare injects the beacon at the edge only when the request accepts HTML. A bare `curl` gets no script; so does one carrying a browser `User-Agent` but no `Accept`. Either would fail the check for the wrong reason |
| Match the `<script>` tag, not the bare host | The host also appears in this site's CSP `<meta>` tag, which is emitted on every page whether or not the beacon is injected. Grepping for `cloudflareinsights` alone passes forever — a check that cannot fail is worse than no check |

The first draft of this check got the second detail wrong and would have been
green for the rest of the project's life.

Revisit if Cloudflare ships a permission group that reaches these endpoints.

### The general shape

Never let an apply create a duplicate of something that already exists. Read the
real identifier from the API first, write an `import` block, and confirm the plan
says *import* rather than *add*. If the import itself cannot read the resource,
the resource does not belong in this state — write down why, and replace it with
a check that observes the effect instead of the setting.
