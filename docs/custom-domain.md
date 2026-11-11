# Moving to a custom domain

> **Status: done.** `playnullstate.xyz` went live on 2026-07-27. The Vercel subdomain still `307`s to
> the new domain on every path. This document stays as the record of what was
> done and the order it had to happen in — and as the runbook if the domain
> ever moves again, where the warning about the Vercel subdomain below is the
> part that still matters most.

The review said one concrete thing about infrastructure:

> The domain needs to be your own with HTTPS not vercel.

`nullstate-ten.vercel.app` works and is served over HTTPS, so this is not a
security gap — it is a credibility one. A link out to the game from inside another app makes a `*.vercel.app` subdomain read as a
preview deploy rather than a product. It is also not yours: it cannot move to
another host, and it disappears if the project is renamed.

This is a runbook, not a suggestion. The order matters, because **one step is
not reversible**.

---

## Steps

1. **Buy the domain.** Any registrar. Prefer something short and typable on a
   phone keyboard — players often open this on a phone, often on a cheap device,
   and often share links by pasting them into WhatsApp.

2. **Add the domain in Vercel.** Project → Settings → Domains → Add. Vercel
   provisions the certificate automatically; HTTPS is not a separate step and
   there is no certificate to renew by hand.

3. **Point DNS at Vercel.** The exact records are shown in the same screen —
   usually an `A` record for the apex and a `CNAME` for `www`. Propagation is
   normally minutes, occasionally a few hours.

4. **Set the public URL.** `NEXT_PUBLIC_SITE_URL=https://yourdomain.com`, also
   applied to Production. This is what fixes the OpenGraph metadata base,
   `robots.txt`, the sitemap and the server-side hostname — all in
   one place, because `lib/siteUrl.ts` is the only file allowed to name the
   URL and `npm run audit` fails if that stops being true.

5. **Keep the Vercel subdomain working.** Do not remove it. Old links exist —
   in Telegram messages, in posts. Vercel
   redirects the subdomain to the primary domain automatically once one is set
   as primary, which is the behaviour you want.

6. **Update what points at the old URL.** Any social profile links, and any
   docs that name the old host.

7. **Re-run PageSpeed against the new domain** and keep the score on record.

## ⚠ The Vercel subdomain can never be deleted

`PassSBTv3` has the Season Pass metadata URL compiled in as a `string public
constant` — no setter, and the contract is deployed:

```solidity
string public constant BASE_URI =
    "https://nullstate-ten.vercel.app/assets/sbt-pass/metadata/";
```

Confirmed by reading the live contract on-chain, not just the source.
`tokenURI(1)` returns
`https://nullstate-ten.vercel.app/assets/sbt-pass/metadata/202607.json`.

That URL resolves today only because the old host `307`s to the current domain,
where `app/assets/sbt-pass/metadata/[file]/route.ts` answers. Delete the Vercel
subdomain and every pass ever minted loses its metadata — permanently, with no
on-chain fix available, because the constant cannot be changed.

If the domain moves again, the redirect chain has to survive too: old host →
whatever the app is served from. Two hops is fine; a broken first hop is not.

*(A separate, pre-existing bug found at the same time: that path had never been
served at all. `public/assets/sbt-pass/` did not exist, so every pass resolved
to a 404 in wallets and explorers — the game itself draws the pass from its own
UI and never reads `tokenURI`, which is why it went unnoticed. Fixed by the
route above.)*

## What does *not* need to change

- **Contract logic.** Nothing on-chain needs redeploying — but see the section
  directly above: `PassSBTv3.BASE_URI` does hardcode the original host, which
  is why the old subdomain has to keep resolving forever.
- **Firebase.** Add the new domain to the authorized-domains list if auth is
  ever used; the RTDB and Firestore calls this app makes are unaffected.
- **The RPC.** Independent of the site's own hostname.
- **The treasury CLI.** `scripts/deposit-reward.js` reads the URL out of
  `lib/siteUrl.ts` rather than keeping its own copy, so it follows along on the
  next `git pull`. `STATS_URL` still overrides it for a one-off.

---

## Verifying afterwards

```bash
curl -sI https://yourdomain.com | head -1          # 200, over TLS
curl -s  https://yourdomain.com/robots.txt         # sitemap line names the new host
curl -s  https://yourdomain.com/sitemap.xml | head # URLs on the new host
```

Then open the game on the new domain, buy the cheapest item, and confirm the
purchase completes and the pass metadata still resolves.
