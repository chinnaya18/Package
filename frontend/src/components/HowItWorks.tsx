/* ── HowItWorks — educational section explaining cloud concepts ── */

import {
  Server, Shuffle, HeartPulse, Container,
  BarChart3, Shield, GitBranch, Layers,
} from 'lucide-react';

const concepts = [
  {
    icon: Shuffle,
    color: '#3b82f6',
    title: 'Load Balancing',
    text: 'Distributes incoming network traffic across multiple servers to ensure no single server bears too much demand, improving responsiveness and availability.',
  },
  {
    icon: Layers,
    color: '#8b5cf6',
    title: 'Horizontal Scaling',
    text: 'Adding more server instances (rather than upgrading a single server) to handle increased load. Each backend here is an independent instance.',
  },
  {
    icon: HeartPulse,
    color: '#22c55e',
    title: 'Health Checks',
    text: 'The load balancer periodically probes each server. Unhealthy servers are removed from the pool automatically and re-added when they recover.',
  },
  {
    icon: Shield,
    color: '#f59e0b',
    title: 'Fault Tolerance',
    text: 'When a server fails, traffic is automatically redirected to healthy servers with no downtime for end users — a key property of cloud systems.',
  },
  {
    icon: Container,
    color: '#ef4444',
    title: 'Containerization',
    text: 'Each service runs in its own Docker container, providing isolation, reproducibility, and easy deployment — just like real cloud infrastructure.',
  },
  {
    icon: GitBranch,
    color: '#06b6d4',
    title: 'Request Routing',
    text: 'The load balancer decides which backend processes each request based on the selected algorithm, weights, and current server state.',
  },
  {
    icon: BarChart3,
    color: '#ec4899',
    title: 'Performance Monitoring',
    text: 'Real-time metrics — response times, throughput, active connections — give visibility into system behavior, essential for cloud operations.',
  },
  {
    icon: Server,
    color: '#84cc16',
    title: 'High Availability',
    text: 'With multiple servers and automatic failover, the system remains available even when individual components fail.',
  },
];

export function HowItWorks() {
  return (
    <div className="how-section" role="region" aria-label="How it works">
      <div className="section__header" style={{ marginBottom: 16 }}>
        <h2 className="section__title">How It Works — Cloud Computing Concepts</h2>
      </div>
      <div className="how-section__grid">
        {concepts.map((c) => (
          <div className="how-card" key={c.title}>
            <div className="how-card__icon" style={{ background: c.color }}>
              <c.icon size={18} />
            </div>
            <div className="how-card__title">{c.title}</div>
            <div className="how-card__text">{c.text}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
