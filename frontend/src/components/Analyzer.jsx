import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import {
  FiRefreshCw, FiInstagram, FiUsers, FiUser, FiGrid, FiBarChart2,
  FiZap, FiHeart, FiMessageCircle, FiShare2, FiBookmark,
  FiTrendingUp, FiEye, FiArrowUp, FiArrowDown, FiDownload, FiVideo,
} from 'react-icons/fi';
import { analyzerAPI } from '../services/api';
import '../styles/Analyzer.css';

const TABS = [
  { id: 'overview', label: 'Overview', icon: <FiGrid /> },
  { id: 'posts', label: 'Posts', icon: <FiInstagram /> },
  { id: 'audience', label: 'Audience', icon: <FiUsers /> },
  { id: 'ai', label: 'AI Analysis', icon: <FiZap /> },
];

const SORT_OPTIONS = [
  { value: 'date', label: 'Latest' },
  { value: 'likes', label: 'Most Liked' },
  { value: 'comments', label: 'Most Comments' },
  { value: 'reach', label: 'Most Reach' },
  { value: 'engagement', label: 'Most Engagement' },
];

const CHART_COLORS = ['#6366F1', '#8B5CF6', '#EC4899', '#F59E0B', '#10B981', '#3B82F6', '#EF4444'];

function StatCard({ icon, label, value, sub, trend }) {
  return (
    <div className="az-stat-card">
      <div className="az-stat-icon">{icon}</div>
      <div className="az-stat-body">
        <span className="az-stat-label">{label}</span>
        <span className="az-stat-value">{value}</span>
        {sub && <span className="az-stat-sub">{sub}</span>}
      </div>
      {trend !== undefined && (
        <div className={`az-stat-trend ${trend >= 0 ? 'up' : 'down'}`}>
          {trend >= 0 ? <FiArrowUp /> : <FiArrowDown />}
          {Math.abs(trend)}%
        </div>
      )}
    </div>
  );
}

function LoadingBlock({ rows = 3 }) {
  return (
    <div className="az-loading-block">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="az-skeleton" style={{ width: `${70 + (i % 3) * 10}%` }} />
      ))}
    </div>
  );
}

function fmt(n) {
  if (n === undefined || n === null) return '—';
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}

function formatDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function OverviewTab({ accountId }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [metric, setMetric] = useState('reach');

  useEffect(() => {
    setLoading(true);
    setError('');
    analyzerAPI.getOverview(accountId)
      .then(r => setData(r.data))
      .catch(e => setError(e.message || 'Failed to load overview'))
      .finally(() => setLoading(false));
  }, [accountId]);

  if (loading) return <LoadingBlock rows={6} />;
  if (error) return <div className="az-error">{error}</div>;
  if (!data) return null;

  const { overview, summary, reach_series, impressions_series, follower_series } = data;

  const seriesMap = {
    reach: reach_series,
    impressions: impressions_series,
    followers: follower_series,
  };
  const activeData = (seriesMap[metric] || []).map(p => ({
    date: formatDate(p.date),
    value: p.value,
  }));

  return (
    <div className="az-tab-content">
      <div className="az-profile-card">
        <div className="az-profile-avatar">
          {overview.profile_picture_url
            ? <img src={overview.profile_picture_url} alt={overview.username} />
            : <FiInstagram size={32} />}
        </div>
        <div className="az-profile-info">
          <h2 className="az-profile-name">{overview.name || overview.username}</h2>
          <span className="az-profile-handle">@{overview.username}</span>
          {overview.biography && <p className="az-profile-bio">{overview.biography}</p>}
          {overview.website && (
            <a className="az-profile-website" href={overview.website} target="_blank" rel="noreferrer">
              {overview.website}
            </a>
          )}
          <span className="az-profile-type">{overview.account_type}</span>
        </div>
        <div className="az-profile-counters">
          <div className="az-counter"><span className="az-counter-val">{fmt(overview.followers_count)}</span><span className="az-counter-label">Followers</span></div>
          <div className="az-counter"><span className="az-counter-val">{fmt(overview.follows_count)}</span><span className="az-counter-label">Following</span></div>
          <div className="az-counter"><span className="az-counter-val">{fmt(overview.media_count)}</span><span className="az-counter-label">Posts</span></div>
        </div>
      </div>

      <div className="az-stats-grid">
        <StatCard icon={<FiEye />} label="Reach (30d)" value={fmt(summary.total_reach_30d)} />
        <StatCard icon={<FiTrendingUp />} label="Impressions (30d)" value={fmt(summary.total_impressions_30d)} />
        <StatCard icon={<FiHeart />} label="Avg Engagement Rate" value={`${summary.avg_engagement_rate}%`} />
        <StatCard icon={<FiInstagram />} label="Total Posts Analyzed" value={fmt(summary.total_posts)} />
      </div>

      <div className="az-chart-card">
        <div className="az-chart-header">
          <h3 className="az-chart-title">30-Day Trend</h3>
          <div className="az-metric-tabs">
            {['reach', 'impressions', 'followers'].map(m => (
              <button
                key={m}
                className={`az-metric-tab${metric === m ? ' active' : ''}`}
                onClick={() => setMetric(m)}
              >
                {m.charAt(0).toUpperCase() + m.slice(1)}
              </button>
            ))}
          </div>
        </div>
        {activeData.length > 0 ? (
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={activeData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} tickLine={false} />
              <YAxis tickFormatter={fmt} tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} tickLine={false} axisLine={false} />
              <Tooltip formatter={(v) => [fmt(v), metric]} contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8 }} />
              <Line type="monotone" dataKey="value" stroke="#6366F1" strokeWidth={2.5} dot={false} activeDot={{ r: 5 }} />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="az-no-data">Not enough data for this metric yet.</div>
        )}
      </div>
    </div>
  );
}

function PostsTab({ accountId }) {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sort, setSort] = useState('date');
  const [selected, setSelected] = useState(null);

  const load = useCallback((s) => {
    setLoading(true);
    setError('');
    analyzerAPI.getPosts(accountId, s)
      .then(r => setPosts(r.data.posts || []))
      .catch(e => setError(e.message || 'Failed to load posts'))
      .finally(() => setLoading(false));
  }, [accountId]);

  useEffect(() => { load(sort); }, [accountId, sort, load]);

  if (loading) return <LoadingBlock rows={5} />;
  if (error) return <div className="az-error">{error}</div>;

  return (
    <div className="az-tab-content">
      <div className="az-posts-toolbar">
        <span className="az-posts-count">{posts.length} posts</span>
        <div className="az-sort-wrap">
          <span className="az-sort-label">Sort by</span>
          <select className="az-sort-select" value={sort} onChange={e => setSort(e.target.value)}>
            {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
      </div>

      <div className="az-posts-grid">
        {posts.map(post => {
          const isVideo = post.media_type === 'VIDEO' || post.media_type === 'REELS';
          const thumb = post.thumbnail_url || (isVideo ? null : post.media_url) || post.media_url;
          return (
          <div key={post.id} className="az-post-card" onClick={() => setSelected(post)}>
            <div className="az-post-thumb">
              {thumb
                ? <><img src={thumb} alt="" />{isVideo && <span className="az-post-video-badge"><FiVideo size={11} /> Reel</span>}</>
                : <div className="az-post-thumb-placeholder"><FiInstagram /></div>}
            </div>
            <div className="az-post-meta">
              <p className="az-post-caption">{post.caption ? post.caption.slice(0, 80) + (post.caption.length > 80 ? '…' : '') : '(no caption)'}</p>
              <span className="az-post-date">{formatDate(post.timestamp)}</span>
              <div className="az-post-metrics">
                <span><FiHeart /> {fmt(post.like_count)}</span>
                <span><FiMessageCircle /> {fmt(post.comments_count)}</span>
                <span><FiEye /> {fmt(post.insights?.reach)}</span>
                <span><FiBookmark /> {fmt(post.insights?.saved)}</span>
              </div>
            </div>
          </div>
          );
        })}
      </div>

      {selected && (
        <div className="az-drawer-overlay" onClick={() => setSelected(null)}>
          <div className="az-drawer" onClick={e => e.stopPropagation()}>
            <button className="az-drawer-close" onClick={() => setSelected(null)}>✕</button>
            <div className="az-drawer-thumb">
              {(() => {
                const isVideo = selected.media_type === 'VIDEO' || selected.media_type === 'REELS';
                const thumb = selected.thumbnail_url || (isVideo ? null : selected.media_url) || selected.media_url;
                return thumb
                  ? <><img src={thumb} alt="" />{isVideo && <span className="az-post-video-badge az-post-video-badge--drawer"><FiVideo size={12} /> Reel</span>}</>
                  : <div className="az-post-thumb-placeholder large"><FiInstagram size={48} /></div>;
              })()}
            </div>
            <div className="az-drawer-body">
              <p className="az-drawer-caption">{selected.caption || '(no caption)'}</p>
              <span className="az-drawer-date">{formatDate(selected.timestamp)}</span>
              <a className="az-drawer-link" href={selected.permalink} target="_blank" rel="noreferrer">View on Instagram ↗</a>
              <div className="az-drawer-metrics">
                <div className="az-drawer-metric"><FiHeart /><span>{fmt(selected.like_count)}</span><label>Likes</label></div>
                <div className="az-drawer-metric"><FiMessageCircle /><span>{fmt(selected.comments_count)}</span><label>Comments</label></div>
                <div className="az-drawer-metric"><FiShare2 /><span>{fmt(selected.insights?.shares)}</span><label>Shares</label></div>
                <div className="az-drawer-metric"><FiBookmark /><span>{fmt(selected.insights?.saved)}</span><label>Saved</label></div>
                <div className="az-drawer-metric"><FiEye /><span>{fmt(selected.insights?.reach)}</span><label>Reach</label></div>
                <div className="az-drawer-metric"><FiTrendingUp /><span>{fmt(selected.insights?.impressions)}</span><label>Impressions</label></div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function AudienceTab({ accountId }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    setError('');
    analyzerAPI.getAudience(accountId)
      .then(r => setData(r.data))
      .catch(e => setError(e.message || 'Failed to load audience'))
      .finally(() => setLoading(false));
  }, [accountId]);

  if (loading) return <LoadingBlock rows={6} />;
  if (error) return <div className="az-error">{error}</div>;
  if (!data) return null;

  const { audience, online_followers } = data;

  const ageGenderRaw = audience.age_gender || [];
  const genderTotals = {};
  const ageTotals = {};
  ageGenderRaw.forEach(entry => {
    const [gender, age] = entry.dimension_values || [];
    const val = entry.value || 0;
    if (gender) genderTotals[gender] = (genderTotals[gender] || 0) + val;
    if (age) ageTotals[age] = (ageTotals[age] || 0) + val;
  });
  const genderData = Object.entries(genderTotals).map(([name, value]) => ({
    name: name === 'F' ? 'Female' : name === 'M' ? 'Male' : 'Other',
    value,
  }));
  const ageData = Object.entries(ageTotals)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([name, value]) => ({ name, value }));

  const citiesRaw = audience.cities || [];
  const citiesData = citiesRaw.slice(0, 7).map(e => ({
    name: (e.dimension_values?.[0] || '?').split(',')[0],
    value: e.value || 0,
  }));

  const countriesRaw = audience.countries || [];
  const countriesData = countriesRaw.slice(0, 7).map(e => ({
    name: e.dimension_values?.[0] || '?',
    value: e.value || 0,
  }));

  const heatmapData = [];
  if (online_followers && typeof online_followers === 'object') {
    const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    for (let day = 0; day < 7; day++) {
      const dayObj = online_followers[String(day)] || {};
      for (let hour = 0; hour < 24; hour++) {
        heatmapData.push({
          day: dayLabels[day],
          hour,
          value: dayObj[String(hour)] || 0,
        });
      }
    }
  }
  const heatmapMax = Math.max(...heatmapData.map(d => d.value), 1);

  return (
    <div className="az-tab-content">
      <div className="az-audience-grid">
        <div className="az-chart-card">
          <h3 className="az-chart-title">Gender Breakdown</h3>
          {genderData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={genderData} cx="50%" cy="50%" outerRadius={80} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                  {genderData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v) => [fmt(v), 'followers']} contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8 }} />
              </PieChart>
            </ResponsiveContainer>
          ) : <div className="az-no-data">No gender data available.</div>}
        </div>

        <div className="az-chart-card">
          <h3 className="az-chart-title">Age Distribution</h3>
          {ageData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={ageData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} tickLine={false} />
                <YAxis tickFormatter={fmt} tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} tickLine={false} axisLine={false} />
                <Tooltip formatter={(v) => [fmt(v), 'followers']} contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8 }} />
                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                  {ageData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : <div className="az-no-data">No age data available.</div>}
        </div>

        <div className="az-chart-card">
          <h3 className="az-chart-title">Top Cities</h3>
          {citiesData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={citiesData} layout="vertical" margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                <XAxis type="number" tickFormatter={fmt} tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} tickLine={false} axisLine={false} />
                <YAxis dataKey="name" type="category" tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} tickLine={false} width={80} />
                <Tooltip formatter={(v) => [fmt(v), 'followers']} contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8 }} />
                <Bar dataKey="value" fill="#6366F1" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <div className="az-no-data">No city data available.</div>}
        </div>

        <div className="az-chart-card">
          <h3 className="az-chart-title">Top Countries</h3>
          {countriesData.length > 0 ? (
            <div className="az-countries-list">
              {countriesData.map((c, i) => {
                const total = countriesData.reduce((s, x) => s + x.value, 0);
                const pct = total > 0 ? ((c.value / total) * 100).toFixed(1) : '0';
                return (
                  <div key={i} className="az-country-row">
                    <span className="az-country-name">{c.name}</span>
                    <div className="az-country-bar-wrap">
                      <div className="az-country-bar" style={{ width: `${pct}%`, background: CHART_COLORS[i % CHART_COLORS.length] }} />
                    </div>
                    <span className="az-country-pct">{pct}%</span>
                    <span className="az-country-val">{fmt(c.value)}</span>
                  </div>
                );
              })}
            </div>
          ) : <div className="az-no-data">No country data available.</div>}
        </div>
      </div>

      {heatmapData.length > 0 && (
        <div className="az-chart-card az-heatmap-card">
          <h3 className="az-chart-title">When Followers Are Online</h3>
          <p className="az-chart-sub">Best times to post for maximum reach</p>
          <div className="az-heatmap">
            <div className="az-heatmap-hours">
              {Array.from({ length: 24 }, (_, h) => (
                <span key={h} className="az-heatmap-hour-label">
                  {h === 0 ? '12a' : h < 12 ? `${h}a` : h === 12 ? '12p' : `${h - 12}p`}
                </span>
              ))}
            </div>
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
              <div key={day} className="az-heatmap-row">
                <span className="az-heatmap-day-label">{day}</span>
                {Array.from({ length: 24 }, (_, h) => {
                  const cell = heatmapData.find(d => d.day === day && d.hour === h);
                  const intensity = cell ? cell.value / heatmapMax : 0;
                  return (
                    <div
                      key={h}
                      className="az-heatmap-cell"
                      title={`${day} ${h}:00 — ${fmt(cell?.value || 0)} online`}
                      style={{ opacity: 0.1 + intensity * 0.9, background: '#6366F1' }}
                    />
                  );
                })}
              </div>
            ))}
          </div>
          <div className="az-heatmap-legend">
            <span>Low</span>
            <div className="az-heatmap-legend-bar" />
            <span>High</span>
          </div>
        </div>
      )}
    </div>
  );
}

function AITab({ accountId, accountUsername }) {
  const [analysis, setAnalysis] = useState('');
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState('');
  const resultRef = useRef(null);

  const run = () => {
    setLoading(true);
    setError('');
    setAnalysis('');
    analyzerAPI.getAI(accountId)
      .then(r => setAnalysis(r.data.analysis || ''))
      .catch(e => setError(e.message || 'AI analysis failed'))
      .finally(() => setLoading(false));
  };

  const downloadPDF = async () => {
    if (!resultRef.current) return;
    setDownloading(true);
    try {
      const { default: jsPDF } = await import('jspdf');
      const { default: html2canvas } = await import('html2canvas');

      const el = resultRef.current;
      const clone = el.cloneNode(true);
      clone.classList.add('az-pdf-capture');
      Object.assign(clone.style, {
        position: 'fixed',
        top: '-9999px',
        left: '-9999px',
        width: el.offsetWidth + 'px',
        zIndex: '-1',
        pointerEvents: 'none',
      });
      document.body.appendChild(clone);
      const canvas = await html2canvas(clone, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
      });
      document.body.removeChild(clone);

      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const margin = 14;
      const contentW = pageW - margin * 2;
      const imgH = (canvas.height * contentW) / canvas.width;

      const date = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
      pdf.setFontSize(9);
      pdf.setTextColor(150);
      pdf.text(`Instagram Analysis — @${accountUsername || 'account'} — ${date}`, margin, 9);

      let yOffset = 14;
      let remaining = imgH;

      while (remaining > 0) {
        const sliceH = Math.min(remaining, pageH - margin - yOffset);
        const srcY = (imgH - remaining) / imgH * canvas.height;
        const srcH = (sliceH / imgH) * canvas.height;

        const sliceCanvas = document.createElement('canvas');
        sliceCanvas.width = canvas.width;
        sliceCanvas.height = srcH;
        const ctx = sliceCanvas.getContext('2d');
        ctx.drawImage(canvas, 0, srcY, canvas.width, srcH, 0, 0, canvas.width, srcH);

        pdf.addImage(sliceCanvas.toDataURL('image/png'), 'PNG', margin, yOffset, contentW, sliceH);
        remaining -= sliceH;

        if (remaining > 0) {
          pdf.addPage();
          pdf.setFontSize(9);
          pdf.setTextColor(150);
          pdf.text(`Instagram Analysis — @${accountUsername || 'account'} — ${date}`, margin, 9);
          yOffset = 14;
        }
      }

      const dateStr = new Date().toISOString().slice(0, 10);
      const handle = accountUsername ? `@${accountUsername}` : `account-${accountId}`;
      pdf.save(`Instagram Analysis ${handle} ${dateStr}.pdf`);
    } catch (e) {
      document.querySelector('.az-pdf-capture')?.remove();
      console.error('PDF export failed', e);
    } finally {
      setDownloading(false);
    }
  };

  function renderAnalysis(text) {
    return text.split('\n').map((line, i) => {
      if (line.startsWith('**') && line.endsWith('**')) {
        return <h4 key={i} className="az-ai-section">{line.replace(/\*\*/g, '')}</h4>;
      }
      if (line.startsWith('- ')) {
        return <li key={i} className="az-ai-bullet">{line.slice(2)}</li>;
      }
      if (line.trim() === '') return <br key={i} />;
      return <p key={i} className="az-ai-para">{line}</p>;
    });
  }

  return (
    <div className="az-tab-content az-ai-tab">
      <div className="az-ai-intro">
        <div className="az-ai-icon-wrap"><FiZap size={28} /></div>
        <div>
          <h3 className="az-ai-title">AI-Powered Analysis</h3>
          <p className="az-ai-desc">
            Groq AI reads all account data — posts, engagement, audience demographics, and reach trends —
            and gives you an actionable strategic breakdown in seconds.
          </p>
        </div>
      </div>

      <div className="az-ai-actions">
        <button className="az-ai-run-btn" onClick={run} disabled={loading}>
          {loading ? <><span className="az-spinner" /> Analyzing…</> : <><FiZap /> Run Analysis</>}
        </button>
        {analysis && (
          <button className="az-ai-download-btn" onClick={downloadPDF} disabled={downloading}>
            {downloading ? <><span className="az-spinner az-spinner--dark" /> Exporting…</> : <><FiDownload /> Download PDF</>}
          </button>
        )}
      </div>

      {error && <div className="az-error">{error}</div>}

      {analysis && (
        <div className="az-ai-result" ref={resultRef}>
          <div className="az-ai-result-header">
            <span className="az-ai-result-label">AI Analysis</span>
            {accountUsername && <span className="az-ai-result-account">@{accountUsername}</span>}
            <span className="az-ai-result-date">{new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
          </div>
          <ul className="az-ai-content">{renderAnalysis(analysis)}</ul>
        </div>
      )}
    </div>
  );
}

function Analyzer() {
  const [accounts, setAccounts] = useState([]);
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [tab, setTab] = useState('overview');
  const [loadingAccounts, setLoadingAccounts] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshMsg, setRefreshMsg] = useState('');
  const [demoMode, setDemoMode] = useState(false);
  const [togglingDemo, setTogglingDemo] = useState(false);

  useEffect(() => {
    analyzerAPI.getAccounts()
      .then(r => {
        const list = r.data.accounts || [];
        setAccounts(list);
        setDemoMode(r.data.demo_mode || false);
        if (list.length > 0) setSelectedAccount(list[0]);
      })
      .catch(() => {})
      .finally(() => setLoadingAccounts(false));
  }, []);

  const handleDemoToggle = () => {
    const next = !demoMode;
    setTogglingDemo(true);
    analyzerAPI.toggleDemo(next)
      .then(() => {
        setDemoMode(next);
        setSelectedAccount(null);
        analyzerAPI.getAccounts().then(r => {
          const list = r.data.accounts || [];
          setAccounts(list);
          if (list.length > 0) setSelectedAccount(list[0]);
        }).catch(() => {});
      })
      .catch(() => {})
      .finally(() => setTogglingDemo(false));
  };

  const handleRefresh = () => {
    if (!selectedAccount) return;
    setRefreshing(true);
    setRefreshMsg('');
    analyzerAPI.refresh(selectedAccount.id)
      .then(() => setRefreshMsg('Data refreshed'))
      .catch(e => setRefreshMsg(e.message || 'Refresh failed'))
      .finally(() => setRefreshing(false));
  };

  const selectAccount = (a) => {
    setSelectedAccount(a);
    setTab('overview');
    setRefreshMsg('');
  };

  // Group accounts by client. Own accounts (is_client_account=false) go under "My Accounts".
  const groups = accounts.reduce((acc, a) => {
    const key = a.is_client_account ? (a.client_display_name || 'Client') : '__own__';
    if (!acc[key]) acc[key] = [];
    acc[key].push(a);
    return acc;
  }, {});
  const groupKeys = Object.keys(groups).sort((a, b) => {
    if (a === '__own__') return -1;
    if (b === '__own__') return 1;
    return a.localeCompare(b);
  });

  if (loadingAccounts) return <div className="az-page"><LoadingBlock rows={4} /></div>;

  if (accounts.length === 0) {
    return (
      <div className="az-page az-empty">
        <FiInstagram size={48} />
        <h2>No Instagram accounts connected</h2>
        <p>Connect a client's Instagram Business or Creator account to start analyzing their performance.</p>
      </div>
    );
  }

  return (
    <div className="az-page">
      <div className="az-header">
        <div className="az-header-left">
          <h1 className="az-page-title"><FiBarChart2 /> Analyzer</h1>
        </div>
        <div className="az-header-right">
          {demoMode && <span className="az-demo-badge">DEMO</span>}
          {refreshMsg && <span className="az-refresh-msg">{refreshMsg}</span>}
          <button
            className={`az-demo-toggle${demoMode ? ' active' : ''}`}
            onClick={handleDemoToggle}
            disabled={togglingDemo}
            title={demoMode ? 'Switch to real data' : 'Switch to demo data'}
          >
            {togglingDemo ? <span className="az-spinner az-spinner--dark" /> : null}
            {demoMode ? 'Demo ON' : 'Demo OFF'}
          </button>
          <button className="az-refresh-btn" onClick={handleRefresh} disabled={refreshing} title="Refresh data">
            <FiRefreshCw className={refreshing ? 'az-spin' : ''} />
            {refreshing ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
      </div>

      <div className="az-selector-panel">
        {groupKeys.map(key => {
          const groupAccounts = groups[key];
          const label = key === '__own__' ? 'My Accounts' : key;
          return (
            <div key={key} className="az-selector-group">
              <span className="az-selector-group-label">
                {key === '__own__' ? <FiUser size={11} /> : <FiUsers size={11} />}
                {label}
              </span>
              <div className="az-selector-accounts">
                {groupAccounts.map(a => (
                  <button
                    key={a.id}
                    className={`az-account-btn${selectedAccount?.id === a.id ? ' active' : ''}`}
                    onClick={() => selectAccount(a)}
                  >
                    <FiInstagram />
                    <span>@{a.username}</span>
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <div className="az-tabs">
        {TABS.map(t => (
          <button
            key={t.id}
            className={`az-tab-btn${tab === t.id ? ' active' : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.icon}
            <span>{t.label}</span>
          </button>
        ))}
      </div>

      <div className="az-body">
        {selectedAccount && tab === 'overview' && <OverviewTab accountId={selectedAccount.id} />}
        {selectedAccount && tab === 'posts' && <PostsTab accountId={selectedAccount.id} />}
        {selectedAccount && tab === 'audience' && <AudienceTab accountId={selectedAccount.id} />}
        {selectedAccount && tab === 'ai' && <AITab accountId={selectedAccount.id} accountUsername={selectedAccount.username} />}
      </div>
    </div>
  );
}

export default Analyzer;
