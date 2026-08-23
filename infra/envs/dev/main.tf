provider "cloudflare" {}

# The dev account deliberately holds no zone. Staging and preview run on
# *.workers.dev, and the Worker scripts are deployed by wrangler, not here.
# This environment exists so dev has its own state key and its own token,
# and so Phase 2 can add a zone without restructuring anything.
