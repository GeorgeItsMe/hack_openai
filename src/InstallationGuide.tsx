import { useState } from 'react';
import { ArrowRight, ArrowUpRight, Check, Copy, Download, Monitor, Sparkles } from 'lucide-react';
import { Cat } from './components';
import './installation-guide.css';

const repository = 'https://github.com/GeorgeItsMe/hack_openai';
const buildCommands = 'npm ci\nnpm run setup\nnpm run build';

function CopyButton({ text, label }: { text: string; label: string }) {
  const [status, setStatus] = useState<'idle' | 'copied' | 'failed'>('idle');
  async function copy() {
    try { await navigator.clipboard.writeText(text); setStatus('copied'); }
    catch { setStatus('failed'); }
  }
  return <span className="install-copy-control"><button type="button" onClick={copy} aria-label={label}>{status === 'copied' ? <Check size={14} /> : <Copy size={14} />} {status === 'copied' ? 'Copied' : 'Copy'}</button><span role="status" className={status === 'failed' ? 'install-copy-error' : undefined}>{status === 'failed' ? 'Select the text to copy it manually.' : status === 'copied' ? `${label}: copied.` : ''}</span></span>;
}

export function InstallationGuide({ onDemo }: { onDemo: () => void }) {
  return <>
    <div className="install-intro">
      <div className="install-mark"><Cat size={35} variant="workspace" /></div>
      <span className="eyebrow">A SIDEKICK IN YOUR ACTUAL BROWSER</span>
      <h2>Your tabs.<br /><span className="serif-word">A little more together.</span></h2>
      <p>Give Tabby a home in Chrome. Here’s how to install the developer preview.</p>
      <div className="install-requirements"><span><Monitor size={14} /> Desktop Chrome 120+</span><span>Node.js 24</span><span>Manual installation</span></div>
    </div>

    <div className="install-release-note"><strong>A little early. A little hands-on.</strong><p>This is a developer preview, installed from source. There’s no Chrome Web Store listing or packaged release yet. The public source may lag behind the latest prototype features while updates are being published, and a build may need fixes. Connected features need separate setup and permissions.</p></div>
    <p className="install-mobile-note">Use Chrome on a computer to install the extension. On your phone? <button onClick={onDemo}>Try the browser demo.</button></p>

    <ol className="install-steps">
      <li><span className="install-step-number">01</span><div><h3>Bring Tabby home.</h3><p>Download the project source and unzip it. You’ll need <a href="https://nodejs.org/en/download" target="_blank" rel="noreferrer">Node.js 24</a> installed on your computer.</p><a className="install-download" href={`${repository}/archive/refs/heads/main.zip`}><Download size={16} /> Download source ZIP <ArrowUpRight size={15} /></a><small>This contains the source code. Build it in the next step.</small></div></li>
      <li><span className="install-step-number">02</span><div><h3>Make your little sidekick.</h3><p>Open a terminal in the unzipped project folder, where <code>package.json</code> lives, and run:</p><div className="install-code"><div><span>In the project folder</span><CopyButton text={buildCommands} label="Copy build commands" /></div><pre><code>{buildCommands}</code></pre></div><p>The finished extension will be in <code>dist/extension</code>.</p></div></li>
      <li><span className="install-step-number">03</span><div><h3>A new home. Fewer rabbit holes.</h3><p>Paste this address into Chrome:</p><div className="install-address"><code>chrome://extensions</code><CopyButton text="chrome://extensions" label="Copy Chrome extensions address" /></div><p>Turn on <strong>Developer mode</strong>, choose <strong>Load unpacked</strong>, and select the project’s <code>dist/extension</code> folder. Pin Tabby from Chrome’s extensions menu and click the cat.</p><small>Tasks, tab tools, and timers work without connecting AI.</small></div></li>
    </ol>

    <details className="install-ai"><summary><Sparkles size={17} /><span>Connect a little AI help <small>Optional · your own provider connection</small></span></summary><div>
      <p>For context-aware nudges and AI suggestions, add your GPT Tunnel API key to the local <code>.env</code> file created by setup. Keep the generated settings, then start the companion server:</p>
      <div className="install-code"><div><span>In the same project folder</span><CopyButton text="npm run server" label="Copy server command" /></div><pre><code>npm run server</code></pre></div>
      <p>Keep that terminal open. In Tabby’s <strong>Settings</strong>, paste the value from <code>.local/pairing.txt</code> into <strong>Local server connection token</strong> and choose <strong>Connect &amp; check</strong>.</p>
      <p>Review the disclosure and turn on <strong>Allow AI analysis</strong>. Visible page text has its own toggle and site permission. Your provider may charge for AI usage.</p>
      <small>The provider key belongs in <code>.env</code>; the extension uses the separate pairing token.</small>
    </div></details>

    <details className="install-ai"><summary><Sparkles size={17} /><span>Bring your MCP assistant along <small>Five local tools · reading and task changes</small></span></summary><div><p>Run <code>npm run setup:mcp</code>, reload Tabby, and open <strong>Settings → MCP access</strong>. Save the separate token from <code>.local/mcp-token.txt</code> and turn on <strong>Allow MCP reading</strong>.</p><p>Enable <strong>Allow MCP task changes</strong> only if your assistant should create and complete tasks. Once enabled, these actions do not need another in-panel click. The five tools read focus, tasks, and tabs, or create and complete tasks.</p><p>Configure your local stdio client using the <a href={`${repository}/blob/main/docs/MCP.md`} target="_blank" rel="noreferrer">MCP setup guide</a>. The SDK client is verified; a Claude Desktop configuration is included. Cloud-hosted ChatGPT cannot directly reach this local bridge. MCP itself makes no AI calls.</p></div></details>
    <details className="install-ai"><summary><Sparkles size={17} /><span>Connect Google, when you’re ready <small>Calendar and Gmail · separate OAuth setup</small></span></summary><div><p>The local Google connectors show your agenda and inbox previews, import chosen items as tasks, and offer reviewed AI drafts. They need a Google Cloud Desktop OAuth client and the running companion server.</p><p>Follow the <a href={`${repository}/blob/main/docs/GOOGLE_AND_CHAT.md`} target="_blank" rel="noreferrer">Google and chat setup guide</a>, then connect each service in <strong>Calendar &amp; mail</strong>. Access is read-only. Live sign-in with a real Google account is still awaiting verification.</p></div></details>
    <details className="install-ai"><summary><Sparkles size={17} /><span>Let your workspace follow you <small>Optional Chrome account sync</small></span></summary><div><p>In <strong>Settings → Workspace sync</strong>, enable sync on each computer using the same Chrome account and extension ID. It includes projects, tasks, notes, and saved links; timers, history, account connections, and permissions stay local.</p><p>Chrome storage limits apply. Delivery between two computers is not yet verified. See the <a href={`${repository}/blob/main/docs/PROJECTS_AND_SYNC.md`} target="_blank" rel="noreferrer">workspace guide</a> for setup and limits.</p></div></details>

    <div className="install-footer"><a href={`${repository}#extension-and-local-server`} target="_blank" rel="noreferrer">Full setup guide on GitHub <ArrowUpRight size={15} /></a><button className="button button-dark" onClick={onDemo}>Just looking? Try the browser demo <ArrowRight size={16} /></button><p>No install. No tab-shaming. Make yourself at home.</p></div>
  </>;
}
