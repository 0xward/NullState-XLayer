{/* Terms of Service — Governing Law, Dispute Resolution, IP, Anti-Cheat, and Web3 Risk sections finalized per content provided directly by 1892 Studio (repo owner) on 2026-07-10. */}

import Navbar from '@/components/ui/Navbar'
import Footer from '@/components/ui/Footer'

export const metadata = {
  title: 'Terms of Service — NULL_STATE',
  description: 'Terms of Service for NULL_STATE, a Web3 RPG on Celo. Operated by 1892 Studio.',
}

const LAST_UPDATED = 'July 21, 2026'

export default function TermsPage() {
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
            Terms of Service
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
              1. Acceptance of Terms
            </h2>
            <div className="pl-4 flex flex-col gap-3">
              <p>
                By accessing or using NULL_STATE (the &quot;Game&quot; or &quot;Service&quot;), including
                connecting a wallet or interacting with any in-game feature, you agree to be
                bound by these Terms of Service (&quot;Terms&quot;). If you do not agree, do not use
                the Service.
              </p>
              <p>
                The Game is developed and operated by <strong className="text-null-white">1892 Studio</strong> (&quot;Publisher&quot;,
                &quot;we&quot;, &quot;us&quot;, or &quot;our&quot;). NULL_STATE is an independent application; it is
                not affiliated with, endorsed by, or operated by MiniPay, Opera, or the Celo
                Foundation. References to those platforms reflect the technology the Game is
                built on or distributed through, not any form of joint operation or sponsorship.
              </p>
            </div>
          </section>

          {/* 2 */}
          <section>
            <h2 className="font-display font-bold text-null-white text-xl mb-3 border-l-2 border-null-green pl-4">
              2. Description of Service
            </h2>
            <div className="pl-4 flex flex-col gap-3">
              <p>
                NULL_STATE is a real-time dungeon-crawler RPG deployed on the Celo blockchain.
                Players connect a self-custodied wallet and participate in item collection and
                season competitions. Movement, combat, looting, and NULL_STRIKE are all free and
                off-chain; only specific optional actions — such as Marketplace purchases and
                Season Pass minting — are executed as signed transactions on Celo mainnet. Weekly
                Treasure Vault and seasonal Leaderboard USDT rewards are paid out to your
                wallet by 1892 Studio when earned.
              </p>
              <p>
                Off-chain game state (item inventory, current progress, season stats) is stored
                in a Firebase-backed database operated by 1892 Studio and governed by our
                Privacy Policy.
              </p>
              <p>
                <strong className="text-null-white">Guest Play:</strong>{' '}
                Outside of MiniPay you may play without connecting a wallet. In this &ldquo;guest&rdquo;
                mode, progress is stored locally on your device (browser localStorage). Guest play
                cannot receive USDT rewards. When you later connect a wallet, your guest
                progress is migrated onto that wallet account on a best-effort basis. Clearing your
                browser storage before connecting may permanently erase un-migrated guest progress.
              </p>
              <p>
                <strong className="text-null-white">NullState Point:</strong>{' '}
                &ldquo;NullState Point&rdquo; is an in-game, faucet-only reward earned by burning
                looted items. It is <strong className="text-null-white">not</strong> a
                cryptocurrency, security, or money: it has no cash value, cannot be withdrawn,
                transferred, traded, or exchanged for stablecoins, and exists only to be spent on
                non-premium Marketplace gear inside the Game. Real USDT rewards come only from
                the weekly Treasure Vault, the seasonal Leaderboard, and Season Pass reward tracks.
              </p>
            </div>
          </section>

          {/* 3 */}
          <section>
            <h2 className="font-display font-bold text-null-white text-xl mb-3 border-l-2 border-null-green pl-4">
              3. Eligibility
            </h2>
            <div className="pl-4 flex flex-col gap-3">
              <p>
                You must be of legal age in your jurisdiction to enter into binding contracts and
                to use blockchain-based applications. By using the Service, you represent that
                you meet this requirement and that you are not prohibited from accessing or using
                the Service under applicable law. The Service is not available in jurisdictions
                where blockchain applications, digital assets, or related activities are
                prohibited.
              </p>
            </div>
          </section>

          {/* 4 */}
          <section>
            <h2 className="font-display font-bold text-null-white text-xl mb-3 border-l-2 border-null-green pl-4">
              4. User Responsibilities
            </h2>
            <div className="pl-4 flex flex-col gap-4">
              <div>
                <h3 className="text-null-green font-mono text-xs tracking-[2px] uppercase mb-2">
                  Wallet &amp; Seed Phrase Security
                </h3>
                <p>
                  You are solely responsible for the security of your wallet, private keys, and
                  seed phrase. <strong className="text-null-white">1892 Studio never has access to
                  your private keys or seed phrase and will never ask for them.</strong> Loss of
                  your seed phrase may result in permanent loss of access to your on-chain
                  assets. Write it down and store it securely offline.
                </p>
              </div>
              <div>
                <h3 className="text-null-green font-mono text-xs tracking-[2px] uppercase mb-2">
                  Transaction Signing
                </h3>
                <p>
                  Every in-game action that affects on-chain state requires you to explicitly
                  sign a transaction using your wallet. By signing, you authorise the
                  corresponding blockchain transaction. Review all transaction details in your
                  wallet before confirming. <strong className="text-null-white">On-chain
                  transactions are irreversible once confirmed.</strong>
                </p>
              </div>
              <div>
                <h3 className="text-null-green font-mono text-xs tracking-[2px] uppercase mb-2">
                  Accurate Information
                </h3>
                <p>
                  You agree not to misrepresent your identity or attempt to impersonate another
                  player or entity. Your wallet address serves as your in-game identity.
                </p>
              </div>
            </div>
          </section>

          {/* 5 */}
          <section>
            <h2 className="font-display font-bold text-null-white text-xl mb-3 border-l-2 border-null-green pl-4">
              5. No Warranty / As-Is / Risk Disclosure
            </h2>
            <div className="pl-4 flex flex-col gap-3">
              <p>
                THE SERVICE IS PROVIDED &quot;AS IS&quot; AND &quot;AS AVAILABLE&quot; WITHOUT WARRANTIES OF
                ANY KIND, EITHER EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO WARRANTIES OF
                MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, OR NON-INFRINGEMENT.
              </p>
              <p>
                <strong className="text-null-white">Blockchain &amp; Smart Contract Risk:</strong>{' '}
                Smart contracts are immutable once deployed and may contain bugs. Blockchain
                transactions carry inherent risk, including network fee volatility, network
                congestion, protocol changes, and the irreversible nature of on-chain actions.
                1892 Studio does not guarantee the correctness of smart contract logic or the
                continued availability of any blockchain network.
              </p>
              <p>
                <strong className="text-null-white">Digital Asset Volatility:</strong>{' '}
                CELO and USDM values can fluctuate significantly. In-game rewards have no
                guaranteed monetary value. You participate at your own financial risk.
              </p>
              <p>
                <strong className="text-null-white">No Audit:</strong>{' '}
                NULL_STATE smart contracts have not undergone a formal third-party security
                audit at the time of this writing. Play with amounts you are comfortable
                risking.
              </p>
              <p>
                <strong className="text-null-white">Service Availability:</strong>{' '}
                We do not guarantee uninterrupted access. The Service may be suspended or
                terminated at any time, with or without notice.
              </p>
            </div>
          </section>

          {/* 6 */}
          <section>
            <h2 className="font-display font-bold text-null-white text-xl mb-3 border-l-2 border-null-green pl-4">
              6. Web3, Stablecoin, and Blockchain Network Risks
            </h2>
            <div className="pl-4 flex flex-col gap-3">
              <p>
                <strong className="text-null-white">Blockchain Infrastructure:</strong>{' '}
                The Game operates on the Celo blockchain network. 1892 Studio is not liable for
                financial losses caused by Celo network congestion, fork events, network
                downtime, or smart contract vulnerabilities.
              </p>
              <p>
                <strong className="text-null-white">Stablecoin Moneyflow Risk:</strong>{' '}
                The Game uses digital stablecoins including but not limited to USDM, USDT,
                and USDC for in-game transactions, rewards, and moneyflows. 1892 Studio does not
                control the issuance, backing, liquidity, or stability of these third-party
                tokens and is not liable for losses arising from de-pegging, smart contract
                failure, freeze functions, or collapse of USDM, USDT, or USDC.
              </p>
              <p>
                <strong className="text-null-white">MiniPay Integration &amp; Non-Custodial Status:</strong>{' '}
                NULL_STATE is listed on MiniPay, a third-party non-custodial wallet interface.
                1892 Studio does not control, manage, or hold custody of your digital assets, private
                keys, or seed phrases. You are solely responsible for securing your wallet, and
                1892 Studio is not liable for wallet-level technical failures, unauthorized access, or
                loss of assets within MiniPay.
              </p>
            </div>
          </section>

          {/* 7 */}
          <section>
            <h2 className="font-display font-bold text-null-white text-xl mb-3 border-l-2 border-null-green pl-4">
              7. Anti-Cheat, Exploitation, and Prohibited Behaviors
            </h2>
            <div className="pl-4 flex flex-col gap-3">
              <p>You agree not to:</p>
              <ul className="flex flex-col gap-2 font-mono text-sm">
                {[
                  'Use cheat scripts, macros, bots, hacks, mods, or unauthorized third-party software to interact with the Service.',
                  'Exploit, abuse, or share bugs, glitches, or vulnerabilities to gain unfair gameplay advantages or unauthorized economic rewards (including USDM, USDT, or USDC distributions).',
                  'Reverse-engineer, decompile, disassemble, scrape, or tamper with frontend code, client scripts, APIs, or proprietary game data beyond permissions granted by applicable licences.',
                  'Conduct Sybil attacks, malicious multi-account behavior, or automated manipulation of leaderboards, rewards, or airdrops.',
                  'Bypass the frontend to maliciously interact with deployed smart contracts, including any flash loan, reentrancy, or math-bug exploitation.',
                  'Harass, threaten, or abuse other users.',
                  'Use the Service for money laundering, fraud, or any illegal purpose.',
                  'Impersonate 1892 Studio, MiniPay, Celo, or any other entity.',
                  'Circumvent or attempt to circumvent any security or access-control mechanism.',
                ].map((item) => (
                  <li key={item} className="pl-4 relative before:content-[&apos;—&apos;] before:absolute before:left-0 before:text-null-green">
                    {item}
                  </li>
                ))}
              </ul>
              <p>
                If 1892 Studio determines or reasonably suspects that you violated this section,
                1892 Studio may, without prior notice, permanently blacklist or ban your wallet
                address from the frontend and related services.
              </p>
              <p>
                1892 Studio may also revoke or freeze licensed off-chain virtual assets and nullify
                pending economic rewards, distributions, or balances obtained through prohibited
                means.
              </p>
            </div>
          </section>

          {/* 8 */}
          <section>
            <h2 className="font-display font-bold text-null-white text-xl mb-3 border-l-2 border-null-green pl-4">
              8. Intellectual Property
            </h2>
            <div className="pl-4 flex flex-col gap-3">
              <p>
                The NULL_STATE frontend and smart contracts are published under the MIT licence
                and available on GitHub. This licence grants you rights to view and use the
                source code subject to its terms. It does not grant rights to the NULL_STATE
                name, logo, or brand assets, which remain the property of 1892 Studio.
              </p>
              <p>
                On-chain data (your wallet address, transaction history, leaderboard rankings,
                Pass NFTs) is public by nature of the Celo blockchain and is not the exclusive
                property of 1892 Studio or any other party.
              </p>
              <p>
                <strong className="text-null-white">Developer Ownership:</strong>{' '}
                Except for User Content and decentralized blockchain data, all right, title, and
                interest in the Game are owned exclusively by 1892 Studio, including code, themes,
                characters, names, stories, dialogue, artwork, animations, sounds, music,
                audio-visual effects, methods of operation, moral rights, and related
                documentation.
              </p>
              <p>
                <strong className="text-null-white">In-Game Items and Virtual Assets:</strong>{' '}
                Virtual items, skins, equipment, and currencies, whether represented on-chain
                as NFTs or off-chain on Game servers, are licensed to you by 1892 Studio solely for
                gameplay purposes under these Terms.
              </p>
              <p>
                <strong className="text-null-white">Blockchain Assets (NFTs):</strong>{' '}
                To the extent the Game permits minting Digital Assets or NFTs on Celo, you own
                the underlying cryptographic token, but this ownership does not grant intellectual
                property rights in underlying artwork, brands, trademarks, or proprietary code
                owned by 1892 Studio, unless expressly stated in a separate NFT License Agreement.
              </p>
              <p>
                <strong className="text-null-white">Secondary Market Disclaimer:</strong>{' '}
                1892 Studio does not guarantee that any in-game asset or NFT will maintain financial
                value. Any trading on third-party marketplaces is at your own risk.
              </p>
            </div>
          </section>

          {/* 9 */}
          <section>
            <h2 className="font-display font-bold text-null-white text-xl mb-3 border-l-2 border-null-green pl-4">
              9. Limitation of Liability
            </h2>
            <div className="pl-4 flex flex-col gap-3">
              <p>
                TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, 0XWARD AND ITS CONTRIBUTORS
                SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR
                PUNITIVE DAMAGES, OR ANY LOSS OF PROFITS, REVENUE, DATA, DIGITAL ASSETS, OR
                GOODWILL, ARISING OUT OF OR IN CONNECTION WITH YOUR USE OF OR INABILITY TO USE
                THE SERVICE, REGARDLESS OF THE THEORY OF LIABILITY AND EVEN IF 0XWARD HAS BEEN
                ADVISED OF THE POSSIBILITY OF SUCH DAMAGES.
              </p>
              <p>
                IN JURISDICTIONS THAT DO NOT ALLOW THE EXCLUSION OR LIMITATION OF LIABILITY FOR
                CONSEQUENTIAL OR INCIDENTAL DAMAGES, THE ABOVE LIMITATIONS SHALL APPLY TO THE
                FULLEST EXTENT PERMITTED BY LAW.
              </p>
              <p>
                TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, 0XWARD&apos;S TOTAL AGGREGATE
                LIABILITY FOR ALL CLAIMS ARISING OUT OF OR RELATING TO THE SERVICE SHALL BE
                LIMITED TO THE LESSER OF: (I) THE TOTAL FEES OR IN-GAME PURCHASES ACTUALLY PAID
                BY YOU TO 0XWARD IN THE THREE (3) MONTHS PRECEDING THE EVENT GIVING RISE TO THE
                LIABILITY; OR (II) USD $100.
              </p>
            </div>
          </section>

          {/* 10 */}
          <section>
            <h2 className="font-display font-bold text-null-white text-xl mb-3 border-l-2 border-null-green pl-4">
              10. Modifications to Terms
            </h2>
            <div className="pl-4">
              <p>
                1892 Studio reserves the right to modify these Terms at any time. Changes take effect
                when posted to this page with an updated &quot;Last updated&quot; date. Continued use of
                the Service after changes are posted constitutes acceptance of the revised Terms.
                We recommend checking this page periodically.
              </p>
            </div>
          </section>

          {/* 11 */}
          <section>
            <h2 className="font-display font-bold text-null-white text-xl mb-3 border-l-2 border-null-green pl-4">
              11. Termination / Suspension of Access
            </h2>
            <div className="pl-4">
              <p>
                1892 Studio may suspend or terminate your access to the Service at any time, without
                notice, for conduct that violates these Terms or is otherwise harmful to other
                users or the integrity of the Game. Because the core game logic lives on a public
                blockchain, termination of access to this frontend does not affect your on-chain
                assets or history.
              </p>
            </div>
          </section>

          {/* 12 */}
          <section>
            <h2 className="font-display font-bold text-null-white text-xl mb-3 border-l-2 border-null-green pl-4">
              12. Governing Law
            </h2>
            <div className="pl-4 flex flex-col gap-3">
              <p>
                These Terms are governed by and construed in accordance with the laws of
                Singapore, without regard to conflict of law principles.
              </p>
              <p>
                The United Nations Convention on Contracts for the International Sale of Goods
                does not apply to these Terms and is expressly excluded.
              </p>
            </div>
          </section>

          {/* 13 */}
          <section>
            <h2 className="font-display font-bold text-null-white text-xl mb-3 border-l-2 border-null-green pl-4">
              13. Dispute Resolution &amp; Binding Arbitration
            </h2>
            <div className="pl-4 flex flex-col gap-3">
              <p>
                <strong className="text-null-white">Amicable Resolution:</strong>{' '}
                You and 1892 Studio agree to notify each other in writing of any dispute within
                thirty (30) days of it arising and to attempt informal resolution for at least
                thirty (30) days before starting formal arbitration.
              </p>
              <p>
                <strong className="text-null-white">Binding Arbitration:</strong>{' '}
                Any dispute not resolved informally shall be referred to and finally resolved by
                arbitration administered by the Singapore International Arbitration Centre (SIAC)
                under the SIAC Arbitration Rules in force at the time arbitration is commenced.
              </p>
              <p>
                <strong className="text-null-white">Seat and Language:</strong>{' '}
                The seat of arbitration is Singapore. The tribunal shall consist of one (1)
                arbitrator. The language of arbitration shall be English.
              </p>
              <p>
                <strong className="text-null-white">Class Action Waiver:</strong>{' '}
                To the maximum extent permitted by law, all arbitration or legal proceedings must
                be conducted only on an individual basis, and not as a class, collective, or
                representative action.
              </p>
            </div>
          </section>

          {/* 14 */}
          <section>
            <h2 className="font-display font-bold text-null-white text-xl mb-3 border-l-2 border-null-green pl-4">
              14. Contact
            </h2>
            <div className="pl-4 flex flex-col gap-3">
              <p>
                For questions about these Terms or for general support, reach the 1892 Studio team via
                our official channels:
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
                  href={'mailto:0xward.dev@gmail.com?subject=' + encodeURIComponent('[NULL_STATE] Support') + '&body=' + encodeURIComponent('Hai,\n\n')}
                  className="text-null-green hover:text-null-acid transition-colors font-mono text-sm"
                >
                  Email Support
                </a>
              </p>
            </div>
          </section>

        </div>

        {/* Footer nav */}
        <div className="mt-16 pt-8 border-t border-[rgba(0,255,136,0.15)] flex flex-wrap gap-6 justify-center font-mono text-[11px] tracking-[2px] uppercase">
          <a href="/privacy" className="text-null-muted hover:text-null-green transition-colors no-underline">
            Privacy Policy
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
