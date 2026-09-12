import './demo-video.css';

export function DemoVideo() {
  return <section className="demo-film section-wrap" id="watch-demo" aria-labelledby="demo-film-title">
    <div className="demo-film-heading">
      <div><div className="eyebrow"><span>✳</span> A LITTLE LOOK AT TABBY</div><h2 id="demo-film-title">A detour. A nudge. <em>Back to you.</em></h2></div>
      <p>One minute. A real browser. A little more focus.</p>
    </div>
    <video controls playsInline preload="none" poster="/demo/tabby-browser-poster.jpg" aria-label="Tabby: a one-minute browser walkthrough of focus, tasks and tab groups" aria-describedby="demo-film-caption">
      <source src="/demo/tabby-browser-demo.mp4" type="video/mp4" />
      <track kind="descriptions" src="/demo/tabby-browser-demo.vtt" srcLang="en" label="English description" />
      <a href="/demo/tabby-browser-demo.mp4">Download the Tabby browser demo</a>
    </video>
    <div className="demo-film-caption" id="demo-film-caption"><span>Set a goal. Find your way back. Turn a page into a plan.</span><span>Real browser & AI responses · Timing condensed · Sound off friendly</span></div>
  </section>;
}
