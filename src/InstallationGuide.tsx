import { useState } from 'react';
import { ArrowRight, ArrowUpRight, Check, Copy, Download, FolderOpen, Monitor, Pin, Puzzle, Sparkles } from 'lucide-react';
import { Cat } from './components';
import './installation-guide.css';

const repository = 'https://github.com/GeorgeItsMe/hack_openai';

function CopyAddress() {
  const [status, setStatus] = useState<'idle' | 'copied' | 'failed'>('idle');
  async function copy() {
    try { await navigator.clipboard.writeText('chrome://extensions'); setStatus('copied'); }
    catch { setStatus('failed'); }
  }
  return <div className="install-address"><code>chrome://extensions</code><span className="install-copy-control"><button type="button" onClick={copy} aria-label="Copy Chrome extensions address">{status === 'copied' ? <Check size={16} /> : <Copy size={16} />} {status === 'copied' ? 'Copied!' : 'Copy address'}</button><span role="status" className={status === 'failed' ? 'install-copy-error' : undefined}>{status === 'failed' ? 'Select the address and copy it manually.' : status === 'copied' ? 'Address copied. Paste it into Chrome’s address bar.' : ''}</span></span></div>;
}

export function InstallationGuide({ onDemo }: { onDemo: () => void }) {
  const [downloadStarted, setDownloadStarted] = useState(false);
  return <>
    <div className="install-intro">
      <div className="install-mark"><Cat size={35} variant="workspace" /></div>
      <span className="eyebrow">A LITTLE SETUP. A LOT OF HEADSPACE.</span>
      <h2>Say hello<br /><span className="serif-word">to Tabby.</span></h2>
      <p>Three little steps. Your new sidekick is ready.</p>
      <div className="install-requirements"><span><Monitor size={15} /> Chrome on a computer</span><span><Check size={15} /> Ready-to-install ZIP</span></div>
    </div>
    <p className="install-mobile-note">On your phone? Install Tabby in Chrome on a computer, or <button onClick={onDemo}>try the browser demo here.</button></p>

    <ol className="install-steps">
      <li><span className="install-step-number">1</span><div>
        <h3>Download &amp; unzip Tabby.</h3>
        <a className="install-download" href="/downloads/Tabby.zip" download="Tabby.zip" onClick={() => setDownloadStarted(true)}><Download size={19} /> Download Tabby <span className="install-zip-badge">ZIP</span></a>
        <span className="install-file-label">Tabby.zip · The extension is already built.</span>
        <p><strong>Mac:</strong> double-click the ZIP.<br /><strong>Windows:</strong> right-click → <strong>Extract All</strong> → <strong>Extract</strong>.</p>
        <p className="install-download-status" role="status">{downloadStarted ? 'Next: unzip Tabby.zip, then follow step 2 below.' : 'Keep the unzipped Tabby folder somewhere permanent, like Documents.'}</p>
      </div></li>
      <li><span className="install-step-number">2</span><div>
        <h3>Open Chrome’s extensions.</h3>
        <p>Copy this address and paste it into Chrome’s address bar:</p>
        <CopyAddress />
        <p>Turn on <strong>Developer mode</strong> in the top-right corner.</p>
        <div className="install-chrome-example" aria-label="Illustration: Developer mode is in the top-right corner of Chrome’s Extensions page"><span>Extensions</span><span>Developer mode <i aria-hidden="true" /></span></div>
      </div></li>
      <li><span className="install-step-number">3</span><div>
        <h3>Choose the Tabby folder.</h3>
        <p>Click <strong>Load unpacked</strong> in the top-left corner. Select the <strong>Tabby folder</strong> you just unzipped.</p>
        <div className="install-folder-example" aria-label="Illustration: Load unpacked, then select the Tabby folder"><span>Load unpacked</span><ArrowRight size={18} aria-hidden="true" /><span><FolderOpen size={23} /> Tabby</span></div>
        <small>Choose the folder containing <code>manifest.json</code>, not the ZIP file.</small>
      </div></li>
    </ol>

    <div className="install-ready"><span className="install-ready-icon"><Cat size={25} /></span><div><strong>There’s a new cat in your browser.</strong><p>Click the <Puzzle size={14} aria-label="puzzle-piece" /> extensions icon, pin <strong>Tabby</strong> <Pin size={13} aria-hidden="true" />, then click the cat. Add a task or start your first focus session.</p></div></div>
    <p className="install-scope">Click Enable AI, enter a goal in Mission, then choose Plan my mission. Review the steps and click Start this plan. DeepSeek is included: no account, API key or local server needed.</p>

    <details className="install-ai"><summary><FolderOpen size={18} /><span>Need a little help installing?</span></summary><div>
      <p><strong>Can’t see the folder?</strong> Unzip the download first. On Windows, choose Extract All; opening the ZIP alone doesn’t extract it.</p>
      <p><strong>“Manifest missing”?</strong> Open the extracted folder and look for <code>manifest.json</code>. If it is inside another Tabby folder, select that inner folder.</p>
      <p><strong>Keep the folder.</strong> Chrome runs Tabby from it, so keep it in the same place after installing.</p>
      <p><strong>No Developer mode?</strong> A work or school computer may restrict extensions. Ask its administrator or use your own computer.</p>
      <p>This preview uses Chrome’s manual installation. <a href="https://developer.chrome.com/docs/extensions/get-started/tutorial/hello-world#load-unpacked" target="_blank" rel="noreferrer">Chrome’s installation guide <ArrowUpRight size={12} /></a></p>
    </div></details>
    <details className="install-ai"><summary><Sparkles size={18} /><span>Want connected tools? <small>Optional · set up when you’re ready</small></span></summary><div>
      <p>DeepSeek AI is included in the hackathon preview. Enable it once after reviewing the data disclosure; fair-use limits apply. Optional Google and MCP connections use a separate companion and your own accounts.</p>
      <ul className="install-connection-links">
        <li><a href={`${repository}#extension-and-local-server`} target="_blank" rel="noreferrer">Advanced: your own AI companion <ArrowUpRight size={14} /></a><span>Optional. Included AI works without this setup.</span></li>
        <li><a href={`${repository}/blob/main/docs/MCP.md`} target="_blank" rel="noreferrer">Connect an MCP assistant <ArrowUpRight size={14} /></a><span>Five local tools, with separate read and task-write permissions.</span></li>
        <li><a href={`${repository}/blob/main/docs/GOOGLE_AND_CHAT.md`} target="_blank" rel="noreferrer">Connect Google Calendar &amp; Gmail <ArrowUpRight size={14} /></a><span>Developer OAuth setup; live Google sign-in is not yet verified.</span></li>
        <li><a href={`${repository}/blob/main/docs/PROJECTS_AND_SYNC.md`} target="_blank" rel="noreferrer">Optional Chrome workspace sync <ArrowUpRight size={14} /></a><span>Enable in Settings. Delivery between computers is not yet verified.</span></li>
      </ul>
    </div></details>
    <div className="install-footer"><button className="button button-dark" onClick={onDemo}>Just looking? Try the browser demo <ArrowRight size={16} /></button><p>Free preview · Manual installation · No Chrome Web Store listing yet.<br />No install in the demo. No tab-shaming anywhere.</p></div>
  </>;
}
