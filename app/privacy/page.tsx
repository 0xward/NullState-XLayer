{/* DRAFT: reviewed against docs/data-safety.md and app data flows. Legal review by 1892 Studio recommended before final submission. Items specifically requiring 1892 Studio confirmation: exact data retention timelines and formal deletion request process. */}

import Navbar from '@/components/ui/Navbar'
import Footer from '@/components/ui/Footer'

export const metadata = {
  title: 'Privacy Policy — NULL_STATE',
  description: 'Privacy Policy for NULL_STATE, a Web3 RPG on Celo. Operated by 1892 Studio.',
}

const LAST_UPDATED = 'July 21, 2026'

export default function PrivacyPage() {
  return (
    <>
      <Navbar />

      <main className="relative z-[2] max-w-3xl mx-auto px-6 pt-32 pb-24">
        {/* Header */}
        <div className="mb-16 border-b border-[rgba(0,255,136,0.15)] pb-10">
          <div className="font-mono text-[10px] tracking-[5px] text-null-green uppercase mb-3">
            // LEGAL
          </div>
          <h1
            className="font-display font-bold text-null-white mb-4"
            style={{ fontSize: 'clamp(28px, 5vw, 44px)', lineHeight: 1.1 }}
          >
            Privacy Policy
          </h1>
          <p className="font-mono text-[11px] tracking-[2px] text-null-muted uppercase mb-2">
            Operated by 1892 Studio
          </p>
          <p className="font-mono text-[10px] tracking-[1px] text-null-muted">
            Last updated: {LAST_UPDATED}
          </p>
        </div>

        <div className="flex flex-col gap-12 text-[15px] leading-relaxed text-null-muted">

          {/* 1 */}
          <section>
            <h2 className="font-display font-bold text-null-white text-xl mb-3 border-l-2 border-null-green pl-4">
              1. Who We Are
            </h2>
            <div className="pl-4">
              <p>
                NULL_STATE is a Web3 dungeon-crawler RPG on the Celo blockchain, developed and
                operated by <strong className="text-null-white">1892 Studio</strong>. This Privacy
                Policy explains what data we collect, how we use it, and your rights with respect
                to that data. NULL_STATE is not affiliated with, endorsed by, or operated by
                MiniPay, Opera, or the Celo Foundation.
              </p>
            </div>
          </section>

          {/* 2 */}
          <section>
            <h2 className="font-display font-bold text-null-white text-xl mb-3 border-l-2 border-null-green pl-4">
              2. What Data We Collect
            </h2>
            <div className="pl-4 flex flex-col gap-6">

              <div>
                <h3 className="text-null-green font-mono text-xs tracking-[2px] uppercase mb-2">
                  2.1 On-Chain Data (Public Blockchain)
                </h3>
                <p className="mb-3">
                  When you interact with NULL_STATE on-chain, the following data is written to the
                  public Celo blockchain and is visible to anyone:
                </p>
                <ul className="flex flex-col gap-2 font-mono text-sm">
                  {[
                    'Your wallet address (used as your in-game identity)',
                    'Stablecoin transfer records (Marketplace purchases, Season Pass, and Vault/Leaderboard reward payouts)',
                    'Vault code submission hashes (proof of puzzle completion)',
                    'Leaderboard snapshots (season-end top-player records)',
                    'Pass NFT ownership (your season pass certificates)',
                    'Transaction hashes and timestamps for all on-chain actions',
                  ].map((item) => (
                    <li key={item} className="pl-4 relative before:content-[&apos;—&apos;] before:absolute before:left-0 before:text-null-green">
                      {item}
                    </li>
                  ))}
                </ul>
                <p className="mt-3 text-null-amber font-mono text-xs border border-[rgba(255,170,0,0.2)] px-3 py-2">
                  Important: On-chain data is public, permanent, and immutable by design. The
                  right to erasure (GDPR Article 17) does not apply to data written to a public
                  blockchain — it cannot be deleted or modified once confirmed.
                </p>
              </div>

              <div>
                <h3 className="text-null-green font-mono text-xs tracking-[2px] uppercase mb-2">
                  2.2 Off-Chain Data (Firebase Database)
                </h3>
                <p className="mb-3">
                  To provide fast, real-time gameplay, we also store the following data in a
                  Firebase (Google) database operated by 1892 Studio:
                </p>
                <ul className="flex flex-col gap-2 font-mono text-sm">
                  {[
                    'Your username (the display name shown on the leaderboard — chosen by you, or auto-generated from the last 4 characters of your address if you never set one)',
                    'If — and only if — you choose to create an account: your email address, or the email address and name held by the Google account you sign in with. This is optional; the game is fully playable without it.',
                    'Item inventory (items collected during your runs)',
                    'Season stats (items earned, kills, days active per season)',
                    'Vault codes (weekly puzzle codes, used for verification only)',
                    'Game progress (current bunker, floor, active run state)',
                  ].map((item) => (
                    <li key={item} className="pl-4 relative before:content-[&apos;—&apos;] before:absolute before:left-0 before:text-null-green">
                      {item}
                    </li>
                  ))}
                </ul>
                <p className="mt-3">
                  Your username is the one piece of this you control directly: it is stored only
                  here, never written to the blockchain, and you can change it at any time from
                  the Settings screen.
                </p>
                <p className="mt-3">
                  <strong className="text-null-white">About the optional account.</strong> Signing
                  in with Google or an email link exists for one reason: so your progress follows
                  you to another device instead of living in one browser. It is handled by Firebase
                  Authentication (Google). We use the email address only to identify your account —
                  we do not send marketing, and we do not sell or share it. An account is not a
                  wallet: it cannot hold funds, buy items, or claim rewards, and it is never written
                  to the blockchain. You can play without one, and you can ask us to delete it.
                </p>
                <p className="mt-3">
                  Off-chain records are keyed to your wallet address.
                  Progress is drafted locally and synced to this database at key moments —
                  advancing a floor, leveling up, dying, or leaving the game — and can also be
                  manually saved at any time.
                </p>
              </div>

              <div>
                <h3 className="text-null-green font-mono text-xs tracking-[2px] uppercase mb-2">
                  2.3 Local Device Storage (Guest Mode &amp; Settings)
                </h3>
                <p className="mb-3">
                  Some data is stored only in your own browser (localStorage) and never leaves your
                  device unless you connect a wallet:
                </p>
                <ul className="flex flex-col gap-2 font-mono text-sm">
                  {[
                    'Guest progress — if you play outside MiniPay without a wallet, your run progress is kept locally under a randomly generated guest id',
                    'A local draft of your latest progress, used to avoid losing a run if the page reloads',
                    'Local preferences such as sound/mute and audio volume',
                  ].map((item) => (
                    <li key={item} className="pl-4 relative before:content-[&apos;—&apos;] before:absolute before:left-0 before:text-null-green">
                      {item}
                    </li>
                  ))}
                </ul>
                <p className="mt-3">
                  When you connect a wallet, guest progress is migrated onto your wallet account on a
                  best-effort basis and the local guest id is then cleared. You can remove all of this
                  at any time by clearing your browser&apos;s site data.
                </p>
              </div>

              <div>
                <h3 className="text-null-green font-mono text-xs tracking-[2px] uppercase mb-2">
                  2.4 What We Do NOT Collect
                </h3>
                <p className="mb-3">
                  NULL_STATE is designed to be minimally invasive. We do <em>not</em> collect:
                </p>
                <ul className="flex flex-col gap-2 font-mono text-sm">
                  {[
                    'Your real name, phone number, date of birth, or any government identity document (KYC)',
                    'Your private key, seed phrase, or any wallet credential',
                    'Payment card or bank account details (all payments are on-chain)',
                    'Location data or device identifiers beyond what a standard web browser may send to our hosting provider',
                  ].map((item) => (
                    <li key={item} className="pl-4 relative before:content-[&apos;—&apos;] before:absolute before:left-0 before:text-null-green">
                      {item}
                    </li>
                  ))}
                </ul>
              </div>

            </div>
          </section>

          {/* 3 */}
          <section>
            <h2 className="font-display font-bold text-null-white text-xl mb-3 border-l-2 border-null-green pl-4">
              3. How We Use Your Data
            </h2>
            <div className="pl-4 flex flex-col gap-3">
              <p>We use the data described above exclusively to:</p>
              <ul className="flex flex-col gap-2 font-mono text-sm">
                {[
                  'Provide and maintain core gameplay functionality (combat, loot, progress saving)',
                  'Operate the season leaderboard and compute rankings',
                  'Verify vault puzzle completions',
                  'Restore your game state when you return to the Game',
                  'Detect and prevent abuse, cheating, or prohibited conduct',
                ].map((item) => (
                  <li key={item} className="pl-4 relative before:content-[&apos;—&apos;] before:absolute before:left-0 before:text-null-green">
                    {item}
                  </li>
                ))}
              </ul>
              <p>
                We do not sell your data. We do not use your data for advertising or marketing
                purposes unrelated to NULL_STATE.
              </p>
            </div>
          </section>

          {/* 4 */}
          <section>
            <h2 className="font-display font-bold text-null-white text-xl mb-3 border-l-2 border-null-green pl-4">
              4. Data Security
            </h2>
            <div className="pl-4 flex flex-col gap-3">
              <p>We apply the following measures to protect your off-chain data:</p>
              <ul className="flex flex-col gap-2 font-mono text-sm">
                {[
                  'HTTPS for all data in transit',
                  'Access control: off-chain records are keyed to your wallet address; the backend cannot access your inventory without a valid wallet-authenticated session',
                  'Smart contracts verify on-chain ownership independently of our backend',
                  'Daily database snapshots with multi-region storage and a disaster-recovery plan',
                ].map((item) => (
                  <li key={item} className="pl-4 relative before:content-[&apos;—&apos;] before:absolute before:left-0 before:text-null-green">
                    {item}
                  </li>
                ))}
              </ul>
              <p>
                No security system is perfect. If you discover a vulnerability, please report it
                via the support channel listed in Section 8.
              </p>
            </div>
          </section>

          {/* 5 */}
          <section>
            <h2 className="font-display font-bold text-null-white text-xl mb-3 border-l-2 border-null-green pl-4">
              5. Third-Party Data Processors
            </h2>
            <div className="pl-4 flex flex-col gap-3">
              <p>We rely on the following third-party processors for the off-chain data layer:</p>
              <ul className="flex flex-col gap-2 font-mono text-sm">
                <li className="pl-4 relative before:content-[&apos;—&apos;] before:absolute before:left-0 before:text-null-green">
                  <strong className="text-null-white">Firebase / Google Cloud</strong> — Provides
                  our real-time database, hosting, and related infrastructure. Google processes
                  data on our behalf subject to Google&apos;s standard data processing terms. See{' '}
                  <a
                    href="https://firebase.google.com/support/privacy"
                    rel="noopener noreferrer"
                    className="text-null-green hover:text-null-acid transition-colors"
                  >
                    Firebase Privacy &amp; Security
                  </a>{' '}
                  for details.
                </li>
                <li className="pl-4 relative before:content-[&apos;—&apos;] before:absolute before:left-0 before:text-null-green">
                  <strong className="text-null-white">Celo Blockchain</strong> — All on-chain
                  interactions are recorded on the public Celo network, which is operated by a
                  distributed set of validators. On-chain data is public and outside any single
                  party&apos;s control once confirmed.
                </li>
              </ul>
              <p>
                We do not share your data with any other third parties for their own marketing or
                commercial purposes.
              </p>
            </div>
          </section>

          {/* 6 */}
          <section>
            <h2 className="font-display font-bold text-null-white text-xl mb-3 border-l-2 border-null-green pl-4">
              6. Data Retention
            </h2>
            <div className="pl-4 flex flex-col gap-3">
              <p>
                <strong className="text-null-white">On-chain data</strong> is permanent by
                design — it cannot be deleted or modified.
              </p>
              <p>
                <strong className="text-null-white">Off-chain data</strong> (Firebase) is retained
                for as long as your account is active or as needed to provide the Service.
              </p>
              <p className="text-null-amber font-mono text-xs border border-[rgba(255,170,0,0.2)] px-3 py-2">
                [Data retention &amp; deletion request process — TBD by 1892 Studio, e.g. specify
                exact retention period after account inactivity, and support contact/process for
                handling formal deletion requests.]
              </p>
            </div>
          </section>

          {/* 7 */}
          <section>
            <h2 className="font-display font-bold text-null-white text-xl mb-3 border-l-2 border-null-green pl-4">
              7. Your Rights
            </h2>
            <div className="pl-4 flex flex-col gap-3">
              <p>
                Depending on your jurisdiction, you may have rights regarding your personal data.
                For your <strong className="text-null-white">off-chain (Firebase) data</strong>,
                we support the following upon request:
              </p>
              <ul className="flex flex-col gap-2 font-mono text-sm">
                {[
                  'Access: request a copy of the off-chain data associated with your wallet address',
                  'Correction: request correction of inaccurate off-chain data',
                  'Deletion: request deletion of your off-chain game data (subject to the retention process TBD above)',
                  'Portability: blockchain data is always publicly accessible; game data can be exported on request',
                ].map((item) => (
                  <li key={item} className="pl-4 relative before:content-[&apos;—&apos;] before:absolute before:left-0 before:text-null-green">
                    {item}
                  </li>
                ))}
              </ul>
              <p>
                As noted in Section 2.1, <strong className="text-null-white">on-chain data
                cannot be deleted</strong>. This is an inherent characteristic of public
                blockchains and is not specific to NULL_STATE.
              </p>
              <p>
                To exercise any of the above rights, contact us via the support channel in
                Section 8.
              </p>
            </div>
          </section>

          {/* 8 */}
          <section>
            <h2 className="font-display font-bold text-null-white text-xl mb-3 border-l-2 border-null-green pl-4">
              8. Contact
            </h2>
            <div className="pl-4 flex flex-col gap-3">
              <p>
                For privacy questions, data requests, or general support, contact the 1892 Studio
                team via the official support channel:
              </p>
              <p>
                <a
                  href="https://t.me/nullstate_id"
                  rel="noopener noreferrer"
                  className="text-null-green hover:text-null-acid transition-colors font-mono text-sm"
                >
                  https://t.me/nullstate_id
                </a>
              </p>
              <p>
                You can also reach us on X (Twitter):{' '}
                <a
                  href="https://x.com/nullstate_id"
                  rel="noopener noreferrer"
                  className="text-null-green hover:text-null-acid transition-colors font-mono text-sm"
                >
                  https://x.com/nullstate_id
                </a>
              </p>
              <p>
                Or email us directly (opens your mail app):{' '}
                {/* Address intentionally not rendered as visible text — mailto only. */}
                <a
                  href={'mailto:0xward.dev@gmail.com?subject=' + encodeURIComponent('[NULL_STATE] Privacy / Support') + '&body=' + encodeURIComponent('Hai,\n\n')}
                  className="text-null-green hover:text-null-acid transition-colors font-mono text-sm"
                >
                  Email Support
                </a>
              </p>
            </div>
          </section>

          {/* 9 */}
          <section>
            <h2 className="font-display font-bold text-null-white text-xl mb-3 border-l-2 border-null-green pl-4">
              9. Changes to This Policy
            </h2>
            <div className="pl-4">
              <p>
                We may update this Privacy Policy from time to time. When we do, we will update
                the &quot;Last updated&quot; date at the top of this page. Continued use of the Service
                after changes are posted constitutes acceptance of the revised Policy.
              </p>
            </div>
          </section>

        </div>

        {/* Footer nav */}
        <div className="mt-16 pt-8 border-t border-[rgba(0,255,136,0.15)] flex flex-wrap gap-6 justify-center font-mono text-[11px] tracking-[2px] uppercase">
          <a href="/terms" className="text-null-muted hover:text-null-green transition-colors no-underline">
            Terms of Service
          </a>
          <a href="/docs" className="text-null-muted hover:text-null-green transition-colors no-underline">
            Docs
          </a>
          <a href="/" className="text-null-muted hover:text-null-green transition-colors no-underline">
            Home
          </a>
        </div>
      </main>

      <Footer />
    </>
  )
}
