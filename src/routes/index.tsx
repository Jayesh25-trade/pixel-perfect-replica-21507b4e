import { useState, type ReactNode } from "react";
import { createFileRoute } from "@tanstack/react-router";

import { Button } from "@/components/ui/button";

const directions = [
  {
    id: "ledger",
    number: "01",
    name: "Clean Ledger",
    description: "Light, calm, and spacious with a familiar banking feel.",
  },
  {
    id: "industrial",
    number: "02",
    name: "Dark Industrial",
    description: "Charcoal surfaces and amber highlights for high contrast.",
  },
  {
    id: "khata",
    number: "03",
    name: "Khata Cards",
    description: "Lively color and compact money cards inspired by Indian ledgers.",
  },
] as const;

type DirectionId = (typeof directions)[number]["id"];

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Aarav Traders – Load Accounts | Choose a Look" },
      {
        name: "description",
        content: "Compare three visual directions for the Aarav Traders load accounts app.",
      },
      { property: "og:title", content: "Aarav Traders – Load Accounts" },
      {
        property: "og:description",
        content: "Compare three visual directions for the Aarav Traders load accounts app.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  const [selected, setSelected] = useState<DirectionId | null>(null);

  return (
    <main className="preview-page">
      <div className="preview-wrap">
        <header className="preview-topbar">
          <div className="preview-brandmark" aria-hidden="true">
            AT
          </div>
          <div>
            <p className="preview-brandname">Aarav Traders</p>
            <p className="preview-brandcaption">Load accounts</p>
          </div>
          <span className="preview-status">Visual previews</span>
        </header>

        <section className="preview-intro" aria-labelledby="preview-title">
          <p className="preview-eyebrow">Choose a visual direction</p>
          <h1 className="preview-title" id="preview-title">
            Three ways to keep the books clear.
          </h1>
          <p className="preview-description">
            Compare the Home and New Load screens in each style. The sample figures follow the
            provided 22-ton and 21.5-ton load examples.
          </p>
        </section>

        <div className="direction-list">
          {directions.map((direction) => (
            <section
              className={`direction-option${selected === direction.id ? " is-selected" : ""}`}
              data-direction={direction.id}
              key={direction.id}
              aria-labelledby={`direction-${direction.id}`}
            >
              <header className="direction-heading">
                <div>
                  <p className="direction-eyebrow">Direction {direction.number}</p>
                  <h2 className="direction-title" id={`direction-${direction.id}`}>
                    {direction.name}
                  </h2>
                  <p className="direction-copy">{direction.description}</p>
                </div>
                <Button
                  type="button"
                  size="lg"
                  variant={selected === direction.id ? "default" : "outline"}
                  className="min-h-12 shrink-0 px-5"
                  aria-pressed={selected === direction.id}
                  onClick={() => setSelected(direction.id)}
                >
                  {selected === direction.id ? "Selected" : "Choose this look"}
                </Button>
              </header>

              <div className="direction-previews" aria-label={`${direction.name} screen previews`}>
                <HomePreview direction={direction.id} />
                <NewLoadPreview direction={direction.id} />
              </div>
            </section>
          ))}
        </div>

        {selected ? (
          <p className="preview-footnote" role="status">
            {directions.find((direction) => direction.id === selected)?.name} selected. You can
            change your choice any time before the full app is built.
          </p>
        ) : null}
      </div>
    </main>
  );
}

function PreviewFrame({
  direction,
  label,
  children,
}: {
  direction: DirectionId;
  label: string;
  children: ReactNode;
}) {
  return (
    <section className="preview-device" data-direction={direction} aria-label={`${label} preview`}>
      <div className="preview-device-label">
        <span>{label}</span>
        <span>12 Jan 2026</span>
      </div>
      {children}
    </section>
  );
}

function SampleHeader() {
  return (
    <div className="sample-app-header">
      <span className="sample-avatar" aria-hidden="true">
        AT
      </span>
      <div>
        <p className="sample-app-name">Aarav Traders</p>
        <p className="sample-app-subtitle">3 partners · Live</p>
      </div>
    </div>
  );
}

function HomePreview({ direction }: { direction: DirectionId }) {
  return (
    <PreviewFrame direction={direction} label="Home">
      <div className="sample-app">
        <SampleHeader />
        <p className="sample-month">January 2026</p>
        <div className="sample-feature">
          <span className="sample-feature-label">Sales this month · before GST</span>
          <strong className="sample-feature-value">₹3,91,500</strong>
          <span className="sample-feature-note">43.5 tons sold across 2 loads</span>
        </div>
        <div className="sample-metric-grid">
          <div className="sample-metric">
            <span className="sample-metric-label">Profit</span>
            <strong className="sample-metric-value">₹13,100</strong>
          </div>
          <div className="sample-metric">
            <span className="sample-metric-label">Unsold stock</span>
            <strong className="sample-metric-value">0 tons</strong>
          </div>
        </div>
        <p className="sample-section-title">
          <span>To receive</span>
          <span>₹4,61,970</span>
        </p>
        <p className="sample-section-title">
          <span>Latest loads</span>
          <span>View all</span>
        </p>
        <LoadSample truck="GJ-18-4821" received="22 t received" profit="₹8,800" />
        <LoadSample truck="GJ-18-7392" received="0.5 t shortage" profit="₹4,300" />
        <div className="sample-nav" aria-hidden="true">
          <span>Home</span>
          <span>Loads</span>
          <span>+ New Load</span>
          <span>Parties</span>
          <span>Reports</span>
        </div>
      </div>
    </PreviewFrame>
  );
}

function LoadSample({
  truck,
  received,
  profit,
}: {
  truck: string;
  received: string;
  profit: string;
}) {
  return (
    <div className="sample-load-row">
      <span className="sample-load-tag" aria-hidden="true">
        22t
      </span>
      <div className="sample-load-details">
        <p className="sample-load-name">Coal · {truck}</p>
        <p className="sample-load-sub">{received}</p>
      </div>
      <span className="sample-load-profit">{profit}</span>
    </div>
  );
}

function NewLoadPreview({ direction }: { direction: DirectionId }) {
  return (
    <PreviewFrame direction={direction} label="New Load">
      <div className="sample-app">
        <SampleHeader />
        <div className="sample-step">
          <p className="sample-step-title">Purchase</p>
          <span className="sample-step-progress">1 of 3</span>
        </div>
        <div className="sample-progress-track" aria-hidden="true" />
        <span className="sample-material-chip">Coal · 18% GST</span>
        <div className="sample-fields">
          <SampleField label="Bought from" value="Raj Coal Supply" />
          <SampleField label="Tons bought" value="22.00 t" />
          <SampleField label="Buy rate · per ton" value="₹7,000" />
        </div>
        <div className="sample-calculation">
          <div className="sample-calculation-row">
            <span>Purchase amount</span>
            <strong>₹1,54,000</strong>
          </div>
          <div className="sample-calculation-row">
            <span>GST · 18%</span>
            <strong>₹27,720</strong>
          </div>
          <div className="sample-calculation-row">
            <span>Bill total</span>
            <strong>₹1,81,720</strong>
          </div>
        </div>
        <div className="sample-profit-strip">
          <span>Purchase ₹1,54,000 · Freight ₹35,200</span>
          <span>Profit ₹4,300</span>
        </div>
        <div className="sample-nav" aria-hidden="true">
          <span>Previous</span>
          <span>Save draft</span>
          <span>Next · Truck</span>
        </div>
      </div>
    </PreviewFrame>
  );
}

function SampleField({ label, value }: { label: string; value: string }) {
  return (
    <div className="sample-field">
      <span className="sample-field-label">{label}</span>
      <div className="sample-field-value">
        <span>{value}</span>
        {label === "Bought from" ? <span aria-hidden="true">⌄</span> : null}
      </div>
    </div>
  );
}