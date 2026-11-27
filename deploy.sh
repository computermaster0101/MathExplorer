#!/usr/bin/env bash
# Deploy Math Explorer to https://mathexplorer.thedigitalspace.net (S3 + CloudFront).
# Uploads exactly what is committed (git archive of HEAD), with each file type set explicitly (the security headers send
# "nosniff", so a .js served as anything but JavaScript would not load), then clears CloudFront's cached copies.
# It never deletes anything: no "sync --delete", so a file removed from the repo stays in the bucket until removed by hand.
# Usage: ./deploy.sh            (uses the AWS CLI's default profile; AWS_PROFILE=name ./deploy.sh for another)
#        PREFIX=mobile ./deploy.sh   a test copy at /mobile/index.html, beside the live site: the pages get noindex so search engines
#                                    leave it alone, and only /mobile/* is refreshed. The live site at / is untouched.
# GitHub Actions runs this on every push to main (.github/workflows/deploy.yml).
set -euo pipefail
PREFIX=${PREFIX:-}; PREFIX=${PREFIX#/}; PREFIX=${PREFIX%/}
BUCKET=s3://mathexplorer.thedigitalspace.net${PREFIX:+/$PREFIX}
DIST=E2FYI06MCHATW2
CC="public, max-age=0, s-maxage=86400"   # browsers check for a newer file every time (a quick 304); the edge keeps a copy for a day

cd "$(dirname "$0")"
[ -z "$(git status --porcelain)" ] || echo "Note: you have uncommitted changes; only what is committed gets deployed."
TMP=$(mktemp -d); trap 'rm -rf "$TMP"' EXIT
git archive HEAD | tar -x -C "$TMP"
rm -rf "$TMP/CLAUDE.md" "$TMP/.gitignore" "$TMP/.gitattributes" "$TMP/deploy.sh" "$TMP/.github"
cd "$TMP"
# a test copy: keep it out of search results (robots.txt and the sitemap belong to the live site)
if [ -n "$PREFIX" ]; then rm -f robots.txt sitemap.xml; find . -name "*.html" -exec sed -i 's|<head>|<head><meta name="robots" content="noindex, nofollow">|' {} +; fi
# every file, every time (about 2.7 MB): "sync" compares size and date, and git archive stamps files with the commit's date,
# so a change that kept a file's size could have been skipped
up() { aws s3 cp . "$BUCKET" --recursive --exclude "*" "$@" --cache-control "$CC" --only-show-errors; }
up --include "*.js" --content-type "text/javascript; charset=utf-8"
up --include "*.html" --content-type "text/html; charset=utf-8"
up --include "*.css" --content-type "text/css; charset=utf-8"
up --include "*.svg" --content-type "image/svg+xml"
up --include "*.png" --content-type "image/png"
up --include "*.jpg" --content-type "image/jpeg"
up --include "*.xml" --content-type "application/xml; charset=utf-8"
up --include "robots.txt" --content-type "text/plain; charset=utf-8"
up --include "*.md" --include "LICENSE" --include "vendor/three/LICENSE" --content-type "text/plain; charset=utf-8"
aws cloudfront create-invalidation --distribution-id "$DIST" --paths "/${PREFIX:+$PREFIX/}*" --query "Invalidation.Id" --output text
echo "Deployed $(git -C "$OLDPWD" rev-parse --short HEAD). Live within a minute or two at https://mathexplorer.thedigitalspace.net/${PREFIX:+$PREFIX/index.html}"
