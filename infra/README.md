# Infrastructure

OpenTofu 1.12.6, provider `cloudflare/cloudflare` 5.23.0.
Remote state: Cloudflare R2 through the S3-compatible backend.

## Ownership boundary

OpenTofu owns: zone, zone settings, DNSSEC, CAA, R2 bucket, `workers_custom_domain`,
Web Analytics site.
Wrangler owns: the Worker script content.

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
| Account | Account Analytics / Read | read the Web Analytics site |

`cloudflare_web_analytics_site` is **account**-scoped: it lives under
`/accounts/{id}/rum/*`, not under the zone, so no amount of zone permission
reaches it. Cloudflare offers **Account Analytics at Read only** — there is no
Edit level to grant.

Read is enough for what this repository asks of it, and the reason is worth
understanding rather than accepting: the declared config matches the site that
already exists, so `import` is a read and the apply that follows computes zero
changes and writes nothing.

The consequence is a resource that **detects drift but cannot correct it**. A
dashboard click that turns Web Analytics off shows up as a diff on the next
plan; applying that diff back would need a write this token does not have.
Reconcile such a diff in the dashboard, not in the pipeline. That is a smaller
loss than it sounds: knowing a setting changed is most of the value, and it is
the half that silently rots without a plan to catch it.

Probe read access before relying on it:

```bash
curl -sS -o /dev/null -w "rum %{http_code}\n" \
  -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  "https://api.cloudflare.com/client/v4/accounts/$TF_VAR_cloudflare_account_id/rum/site_info/list"
```

`200` means the import will work. If a future plan ever proposes a *change*
rather than an import, stop: that write will fail with `403`, and the fix is to
make the config match reality, not to run the apply.

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

## Adopting resources created outside OpenTofu

Web Analytics was switched on in the dashboard on 2026-08-23, before it was
declared here. Declaring it without adopting it would have created a **second**
site for the same zone and changed the beacon token on live pages.

`envs/prod/main.tf` carries an `import` block for it. Run:

```bash
cd infra/envs/prod
tofu plan     # expect: 1 to import, 0 to add, 0 to change, 0 to destroy
tofu apply
tofu plan     # expect: No changes.
```

Then delete the `import` block: it is one-time scaffolding, and a plan that is
already clean does not need it.

The general shape, for the next time something is clicked before it is
declared: never let apply create a duplicate. Read the real identifier from the
API first, write the `import` block, and confirm plan says *import* rather than
*add*.
