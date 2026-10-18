/**
 * What index.html shows until the app starts, kept while the first page loads: the app's frame for someone signed in
 * last time (body.booting-signed-in), a spinner otherwise. The Angular app shows it until it boots.
 */
export function BootFrame() {
  return (
    <>
      <div className="boot-frame" aria-hidden="true">
        <div className="boot-navbar"><span className="boot-block boot-logo"></span><span className="boot-block boot-search"></span><span className="boot-block boot-avatar"></span></div>
        <div className="boot-sidebar"><span className="boot-block"></span><span className="boot-block"></span><span className="boot-block"></span><span className="boot-block"></span></div>
        <div className="boot-main">
          <span className="boot-block boot-title"></span>
          <span className="boot-block boot-subtitle"></span>
          <div className="boot-card"><span className="boot-block"></span><span className="boot-block"></span><span className="boot-block"></span><span className="boot-block"></span><span className="boot-block"></span><span className="boot-block"></span></div>
        </div>
      </div>
      <div className="main-spinner-wrapper">
        <div className="donut"></div>
      </div>
    </>
  );
}
