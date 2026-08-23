# Infrastructure

OpenTofu 1.12.6, provider `cloudflare/cloudflare` 5.23.0.
Remote state: Cloudflare R2 through the S3-compatible backend.

## Ownership boundary

OpenTofu owns: zone, zone settings, DNSSEC, CAA, R2 bucket, `workers_custom_domain`.
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
