import './demo-video.css';

export function DemoVideo() {
  return <section className="demo-film section-wrap" id="watch-demo" aria-labelledby="demo-film-title">
    <div className="demo-film-heading">
      <div><div className="eyebrow"><span>✳</span> A LITTLE LOOK AT TABBY</div><h2 id="demo-film-title">A detour. A nudge. <em>Back to you.</em></h2></div>
      <p>See context-aware focus in 15 seconds.</p>
    </div>
    <video controls playsInline preload="none" poster="/demo/tabby-focus-poster.jpg" aria-label="Tabby: a 15-second focus and return walkthrough" aria-describedby="demo-film-caption">
      <source src="/demo/tabby-focus-demo.mp4" type="video/mp4" />
      <track kind="descriptions" src="/demo/tabby-focus-demo.vtt" srcLang="en" label="English description" />
      <a href="/demo/tabby-focus-demo.mp4">Download the Tabby demo video</a>
    </video>
    <div className="demo-film-caption" id="demo-film-caption"><span>A React task, a distracting tab, and one click back to work.</span><span>Illustrated walkthrough · Sound off friendly</span></div>
  </section>;
}
