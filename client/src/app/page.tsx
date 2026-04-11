export default function Home() {
  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold text-gray-900">CourtVision</h1>
      <p className="mt-2 text-gray-600">
        NBA Analytics Platform — Player Genome, Market Inefficiency, Lineup
        Laboratory, Trade & Draft Simulator.
      </p>
      <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { title: "Player Genome", desc: "Multi-dimensional player profiling", href: "/genome" },
          { title: "Market", desc: "Value spread & inefficiency detection", href: "/market" },
          { title: "Lineups", desc: "Rotation optimization & simulation", href: "/lineups" },
          { title: "Trades & Draft", desc: "Cap-aware trade machine & draft board", href: "/trades" },
        ].map((card) => (
          <a
            key={card.href}
            href={card.href}
            className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md"
          >
            <h2 className="text-lg font-semibold text-gray-900">{card.title}</h2>
            <p className="mt-1 text-sm text-gray-500">{card.desc}</p>
          </a>
        ))}
      </div>
    </div>
  );
}
