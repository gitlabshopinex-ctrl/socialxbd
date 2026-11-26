export default function HomeSkeleton() {
  return (
    <div className="sx-home sx-home-loading" aria-label="Loading your feed" aria-busy="true">
      <div className="sx-stories" aria-hidden="true">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="sx-story">
            <span className="sx-story-image sx-skeleton" />
            <span className="sx-skeleton mt-2 mx-auto block h-3 w-12 rounded" />
          </div>
        ))}
      </div>
      {[0, 1, 2].map((i) => (
        <div key={i} className={i === 0 ? "sx-post sx-post-lead" : "sx-post"} aria-hidden="true">
          <div className="flex items-start gap-3">
            <span className="sx-skeleton h-11 w-11 rounded-full shrink-0" />
            <div className="flex-1 space-y-2 py-1">
              <span className="sx-skeleton block h-3.5 w-40 rounded" />
              <span className="sx-skeleton block h-3 w-48 rounded" />
            </div>
          </div>
          {i === 0 && <span className="sx-skeleton block mt-[18px] h-[26px] w-44 rounded-full" />}
          <div className="sx-post-caption space-y-3">
            <span className="sx-skeleton block h-3 w-full rounded" />
            <span className="sx-skeleton block h-3 w-[95%] rounded" />
            <span className="sx-skeleton block h-3 w-4/5 rounded" />
            <span className="sx-skeleton block h-3 w-[90%] rounded" />
          </div>
          {i !== 0 && <div className="sx-skeleton mt-5 aspect-[1.08] rounded-xl" />}
          <div className="sx-post-actions">
            {Array.from({ length: 5 }, (_, j) => <span key={j} className="sx-skeleton w-8 h-4 rounded" />)}
          </div>
        </div>
      ))}
    </div>
  );
}
