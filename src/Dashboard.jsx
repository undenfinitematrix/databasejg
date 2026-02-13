import { useState, useEffect } from 'react';
import Login from './Login';
import { createClient } from '@supabase/supabase-js';

// =============================================
// CONFIGURATION - Uses environment variables
// =============================================
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://adrggnyapfoxoebdbuqf.supabase.co';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'git rm -r --cached node_modules';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// =============================================
// MAIN DASHBOARD COMPONENT
// =============================================
export default function Dashboard() {
  const [theme, setTheme] = useState('light');
  const [dateRange, setDateRange] = useState('30d');
  const [recordsPerPage, setRecordsPerPage] = useState(25);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [signups, setSignups] = useState([]);
  const [metrics, setMetrics] = useState({
    totalSignups: 0,
    activated: 0,
    converted: 0,
    activationRate: 0,
    avgTimeToActivation: 0,
    prevSignups: 0,
    prevActivated: 0,
    prevConverted: 0,
    prevAvgTime: 0
  });
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const handleLogin = () => {
  setIsAuthenticated(true);
};
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
  supabase.auth.getSession().then(({ data }) => {
    if (data.session) {
      setIsAuthenticated(true);
    }
  });
}, []);


  // Date range calculations
  const getDateRange = (range) => {
    const now = new Date();
    const end = now.toISOString();
    let start, prevStart, prevEnd;
    
    switch (range) {
      case 'today':
        start = new Date(now.setHours(0, 0, 0, 0)).toISOString();
        prevStart = new Date(now.setDate(now.getDate() - 1)).toISOString();
        prevEnd = new Date(now.setHours(23, 59, 59, 999)).toISOString();
        break;
      case '7d':
        start = new Date(now.setDate(now.getDate() - 7)).toISOString();
        prevStart = new Date(now.setDate(now.getDate() - 7)).toISOString();
        prevEnd = start;
        break;
      case '30d':
        start = new Date(now.setDate(now.getDate() - 30)).toISOString();
        prevStart = new Date(now.setDate(now.getDate() - 30)).toISOString();
        prevEnd = start;
        break;
      case '90d':
        start = new Date(now.setDate(now.getDate() - 90)).toISOString();
        prevStart = new Date(now.setDate(now.getDate() - 90)).toISOString();
        prevEnd = start;
        break;
      case 'ytd':
        start = new Date(now.getFullYear(), 0, 1).toISOString();
        prevStart = new Date(now.getFullYear() - 1, 0, 1).toISOString();
        prevEnd = new Date(now.getFullYear() - 1, 11, 31).toISOString();
        break;
      default:
        start = new Date(now.setDate(now.getDate() - 30)).toISOString();
    }
    
    return { start, end: new Date().toISOString(), prevStart, prevEnd };
  };

  // Fetch metrics
  const fetchMetrics = async () => {
    const { start, end, prevStart, prevEnd } = getDateRange(dateRange);
    
    // Current period metrics
    const { data: current, error: currentError } = await supabase
      .from('signups')
      .select('*', { count: 'exact' })
      .gte('signup_date', start)
      .lte('signup_date', end);

    // Previous period metrics
    const { data: previous } = await supabase
      .from('signups')
      .select('*', { count: 'exact' })
      .gte('signup_date', prevStart)
      .lte('signup_date', prevEnd);

    if (currentError) {
      console.error('Error fetching metrics:', currentError);
      return;
    }

    const currentData = current || [];
    const prevData = previous || [];

    const activated = currentData.filter(s => s.activation_date).length;
    const converted = currentData.filter(s => ['pro', 'enterprise'].includes(s.current_plan)).length;
    const prevActivated = prevData.filter(s => s.activation_date).length;
    const prevConverted = prevData.filter(s => ['pro', 'enterprise'].includes(s.current_plan)).length;

    
const activatedSignups = currentData.filter(s => s.activation_date);

const avgTimeMs = activatedSignups.length > 0
  ? activatedSignups.reduce((sum, s) => {
      const diff = new Date(s.activation_date) - new Date(s.signup_date);
      return sum + diff;
    }, 0) / activatedSignups.length
  : 0;

const prevActivatedSignups = prevData.filter(s => s.activation_date);

const prevAvgTimeMs = prevActivatedSignups.length > 0
  ? prevActivatedSignups.reduce((sum, s) => {
      const diff = new Date(s.activation_date) - new Date(s.signup_date);
      return sum + diff;
    }, 0) / prevActivatedSignups.length
  : 0;


    setMetrics({
      totalSignups: currentData.length,
      activated,
      converted,
      activationRate: currentData.length > 0 ? ((activated / currentData.length) * 100).toFixed(1) : 0,
      prevSignups: prevData.length,
      prevActivated,
      prevConverted,
     avgTimeToActivation: formatDuration(avgTimeMs),
    prevAvgTime: formatDuration(prevAvgTimeMs)

    });
  };

  // Fetch signups for table
  const fetchSignups = async () => {
    setLoading(true);
    const { start, end } = getDateRange(dateRange);
    const offset = (currentPage - 1) * recordsPerPage;

    let query = supabase
      .from('signups')
      .select('*', { count: 'exact' })
      .gte('signup_date', start)
      .lte('signup_date', end)
      .order('signup_date', { ascending: false })
      .range(offset, offset + recordsPerPage - 1);

    if (searchTerm) {
      query = query.or(`email.ilike.%${searchTerm}%,business_name.ilike.%${searchTerm}%,country.ilike.%${searchTerm}%`);
    }

    const { data, error, count } = await query;

    if (error) {
      console.error('Error fetching signups:', error);
    } else {
      setSignups(data || []);
      setTotalCount(count || 0);
    }
    setLoading(false);
  };

  // Effects
  useEffect(() => {
    fetchMetrics();
    fetchSignups();
  }, [dateRange]);

  useEffect(() => {
    fetchSignups();
  }, [currentPage, recordsPerPage, searchTerm]);

  // Format date to DD/MM/YY hh:mm AM/PM
  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    const date = new Date(dateStr);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = String(date.getFullYear()).slice(-2);
    const hours = date.getHours();
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const hour12 = hours % 12 || 12;
    return `${day}/${month}/${year} ${String(hour12).padStart(2, '0')}:${minutes} ${ampm}`;
  };

  // Format milliseconds into Days Hours Minutes
const formatDuration = (ms) => {
  if (!ms || ms <= 0) return '0d 0h 0m';

  const totalMinutes = Math.floor(ms / (1000 * 60));
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;

  return `${days}d ${hours}h ${minutes}m`;
};

  // Calculate percentage change
  const calcChange = (current, previous) => {
    if (previous === 0) return current > 0 ? 100 : 0;
    return (((current - previous) / previous) * 100).toFixed(0);
  };

  // Pagination
  const totalPages = Math.ceil(totalCount / recordsPerPage);
  const getPageNumbers = () => {
    const pages = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (currentPage > 3) pages.push('...');
      for (let i = Math.max(2, currentPage - 1); i <= Math.min(totalPages - 1, currentPage + 1); i++) {
        pages.push(i);
      }
      if (currentPage < totalPages - 2) pages.push('...');
      pages.push(totalPages);
    }
    return pages;
  };

  // Plan badge styling
  const getPlanBadgeClass = (plan) => {
    switch (plan) {
      case 'free': return 'plan-badge free';
      case 'free_trial': return 'plan-badge trial';
      case 'pro': case 'enterprise': return 'plan-badge paid';
      case 'churned': return 'plan-badge churned';
      default: return 'plan-badge free';
    }
  };

  const getPlanLabel = (plan) => {
    switch (plan) {
      case 'free': return 'Free';
      case 'free_trial': return 'Free Trial';
      case 'pro': return 'Pro';
      case 'enterprise': return 'Enterprise';
      case 'churned': return 'Churned';
      default: return plan;
    }
  };

  const getSourceLabel = (source) => {
    switch (source) {
      case 'app_store': return 'App Store';
      case 'google_search': return 'Google Search';
      case 'direct': return 'Direct';
      case 'referral': return 'Referral';
      case 'paid_ads': return 'Paid Ads';
      default: return source || '—';
    }
  };
  if (!isAuthenticated) {
  return <Login onLogin={handleLogin} />;
}

  return (
    <div className={`dashboard ${theme}`} data-theme={theme}>
      <style>{`
        :root {
          --bg-primary: #f8f9fa;
          --bg-secondary: #ffffff;
          --bg-tertiary: #e9ecef;
          --bg-card: #ffffff;
          --border: #dee2e6;
          --text-primary: #212529;
          --text-secondary: #495057;
          --text-muted: #868e96;
          --accent-blue: #3b82f6;
          --accent-green: #10b981;
          --accent-amber: #f59e0b;
          --accent-red: #ef4444;
          --accent-purple: #8b5cf6;
          --shadow: 0 1px 3px rgba(0,0,0,0.08);
          --shadow-hover: 0 4px 12px rgba(0,0,0,0.1);
        }

        [data-theme="dark"] {
          --bg-primary: #0a0a0b;
          --bg-secondary: #121214;
          --bg-tertiary: #1a1a1d;
          --bg-card: #16161a;
          --border: #2a2a2e;
          --text-primary: #fafafa;
          --text-secondary: #a0a0a5;
          --text-muted: #6a6a6f;
          --shadow: 0 1px 3px rgba(0,0,0,0.3);
          --shadow-hover: 0 4px 12px rgba(0,0,0,0.4);
        }

        * { margin: 0; padding: 0; box-sizing: border-box; }

        .dashboard {
          font-family: 'DM Sans', -apple-system, sans-serif;
          background: var(--bg-primary);
          color: var(--text-primary);
          min-height: 100vh;
          line-height: 1.5;
          transition: background 0.3s, color 0.3s;
          max-width: 1400px;
          margin: 0 auto;
          padding: 40px 32px;
        }

        .header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 48px;
          flex-wrap: wrap;
          gap: 20px;
        }

        .header-left h1 {
          font-size: 28px;
          font-weight: 600;
          letter-spacing: -0.5px;
          margin-bottom: 4px;
        }

        .header-left p {
          color: var(--text-secondary);
          font-size: 14px;
        }

        .header-right {
          display: flex;
          gap: 12px;
          align-items: center;
          flex-wrap: wrap;
        }

        .date-filter {
          display: flex;
          background: var(--bg-tertiary);
          border-radius: 8px;
          padding: 4px;
          gap: 4px;
        }

        .date-filter button {
          font-family: inherit;
          font-size: 13px;
          padding: 8px 16px;
          border: none;
          background: transparent;
          color: var(--text-secondary);
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .date-filter button:hover { color: var(--text-primary); }

        .date-filter button.active {
          background: var(--bg-card);
          color: var(--text-primary);
          box-shadow: var(--shadow);
        }

        .header-btn {
          font-family: inherit;
          font-size: 13px;
          padding: 10px 16px;
          border: 1px solid var(--border);
          background: var(--bg-secondary);
          color: var(--text-secondary);
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.2s;
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .header-btn:hover {
          border-color: var(--text-muted);
          color: var(--text-primary);
        }

        .theme-toggle {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 12px;
          background: var(--bg-tertiary);
          border-radius: 8px;
          cursor: pointer;
          border: 1px solid var(--border);
        }

        .theme-toggle-track {
          width: 44px;
          height: 24px;
          background: var(--border);
          border-radius: 12px;
          position: relative;
          transition: background 0.3s;
        }

        .theme-toggle-thumb {
          width: 20px;
          height: 20px;
          background: var(--bg-card);
          border-radius: 50%;
          position: absolute;
          top: 2px;
          left: 2px;
          transition: transform 0.3s;
          box-shadow: 0 1px 3px rgba(0,0,0,0.2);
        }

        [data-theme="dark"] .theme-toggle-thumb { transform: translateX(20px); }
        [data-theme="dark"] .theme-toggle-track { background: var(--accent-blue); }

        .theme-toggle-label {
          font-size: 13px;
          color: var(--text-secondary);
        }

        .metrics-grid {
          display: grid;
          grid-template-columns: repeat(5, 1fr);
          gap: 16px;
          margin-bottom: 32px;
        }

        .metric-card {
          background: var(--bg-card);
          border: 1px solid var(--border);
          border-radius: 12px;
          padding: 24px;
          position: relative;
          overflow: hidden;
          box-shadow: var(--shadow);
          transition: box-shadow 0.2s;
        }

        .metric-card:hover { box-shadow: var(--shadow-hover); }

        .metric-card::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 3px;
          background: var(--accent-blue);
          opacity: 0;
          transition: opacity 0.2s;
        }

        .metric-card:hover::before { opacity: 1; }
        .metric-card.green::before { background: var(--accent-green); }
        .metric-card.amber::before { background: var(--accent-amber); }
        .metric-card.purple::before { background: var(--accent-purple); }

        .metric-label {
          font-size: 12px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          color: var(--text-muted);
          margin-bottom: 12px;
          font-weight: 500;
        }

        .metric-value {
          font-family: 'JetBrains Mono', monospace;
          font-size: 36px;
          font-weight: 500;
          letter-spacing: -1px;
          margin-bottom: 8px;
        }

        .metric-card.green .metric-value { color: var(--accent-green); }
        .metric-card.amber .metric-value { color: var(--accent-amber); }
        .metric-card.purple .metric-value { color: var(--accent-purple); }

        .metric-change {
          font-size: 13px;
          color: var(--text-secondary);
          display: flex;
          align-items: center;
          gap: 4px;
        }

        .metric-change.up { color: var(--accent-green); }
        .metric-change.down { color: var(--accent-red); }

        .section-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
        }

        .section-title {
          font-size: 16px;
          font-weight: 600;
          color: var(--text-primary);
        }

        .funnel-bar {
          display: flex;
          height: 48px;
          background: var(--bg-secondary);
          border-radius: 8px;
          overflow: hidden;
          margin-bottom: 40px;
          border: 1px solid var(--border);
        }

        .funnel-segment {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          font-size: 13px;
          font-weight: 500;
          color: #fff;
          transition: all 0.3s;
        }

        .funnel-segment:hover { filter: brightness(1.1); }
        .funnel-segment.signups { background: var(--accent-blue); flex: 1; }
        .funnel-segment.activated { background: var(--accent-green); }
        .funnel-segment.converted { background: var(--accent-purple); }
        .funnel-segment .num { font-family: 'JetBrains Mono', monospace; font-weight: 600; }

        .table-container {
          background: var(--bg-card);
          border: 1px solid var(--border);
          border-radius: 12px;
          overflow: hidden;
          box-shadow: var(--shadow);
        }

        .table-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 20px 24px;
          border-bottom: 1px solid var(--border);
          flex-wrap: wrap;
          gap: 12px;
        }

        .table-header h3 { font-size: 15px; font-weight: 600; }

        .table-controls {
          display: flex;
          gap: 12px;
          align-items: center;
          flex-wrap: wrap;
        }

        .search-input {
          font-family: inherit;
          font-size: 13px;
          padding: 10px 14px 10px 36px;
          border: 1px solid var(--border);
          background: var(--bg-secondary);
          color: var(--text-primary);
          border-radius: 8px;
          width: 260px;
          outline: none;
          transition: border-color 0.2s;
        }

        .search-input::placeholder { color: var(--text-muted); }
        .search-input:focus { border-color: var(--accent-blue); }

        .records-select {
          font-family: inherit;
          font-size: 13px;
          padding: 10px 32px 10px 14px;
          border: 1px solid var(--border);
          background: var(--bg-secondary);
          color: var(--text-primary);
          border-radius: 8px;
          cursor: pointer;
          outline: none;
        }

        .filter-btn {
          font-family: inherit;
          font-size: 13px;
          padding: 10px 14px;
          border: 1px solid var(--border);
          background: var(--bg-secondary);
          color: var(--text-secondary);
          border-radius: 8px;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 6px;
          transition: all 0.2s;
        }

        .filter-btn:hover {
          border-color: var(--text-muted);
          color: var(--text-primary);
        }

        .table-wrapper { overflow-x: auto; }

        table {
          width: 100%;
          border-collapse: collapse;
          min-width: 1600px;
        }

        thead { background: var(--bg-tertiary); }

        th {
          text-align: left;
          padding: 14px 16px;
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          color: var(--text-muted);
          font-weight: 600;
          border-bottom: 1px solid var(--border);
          white-space: nowrap;
        }

        td {
          padding: 14px 16px;
          font-size: 14px;
          border-bottom: 1px solid var(--border);
          color: var(--text-secondary);
          white-space: nowrap;
        }

        tr:last-child td { border-bottom: none; }
        tr:hover { background: var(--bg-tertiary); }

        .email-cell { color: var(--text-primary); font-weight: 500; }

        .plan-badge {
          padding: 4px 10px;
          border-radius: 6px;
          font-size: 12px;
          font-weight: 500;
          display: inline-block;
        }

        .plan-badge.free { background: var(--bg-tertiary); color: var(--text-secondary); }
        .plan-badge.trial { background: rgba(59, 130, 246, 0.15); color: var(--accent-blue); }
        .plan-badge.paid { background: rgba(139, 92, 246, 0.15); color: var(--accent-purple); }
        .plan-badge.churned { background: rgba(239, 68, 68, 0.15); color: var(--accent-red); }

        .source-tag { font-size: 12px; color: var(--text-muted); }
        .mono { font-family: 'JetBrains Mono', monospace; font-size: 12px; }

        .link-cell {
          color: var(--accent-blue);
          text-decoration: none;
          font-size: 12px;
          font-weight: 500;
          padding: 4px 8px;
          border-radius: 4px;
          background: rgba(59, 130, 246, 0.1);
          transition: all 0.2s;
          display: inline-block;
        }

        .link-cell:hover {
          background: rgba(59, 130, 246, 0.2);
          text-decoration: none;
        }

        .link-cell.admin-link {
          color: var(--accent-purple);
          background: rgba(139, 92, 246, 0.1);
        }

        .link-cell.admin-link:hover {
          background: rgba(139, 92, 246, 0.2);
        }

        .table-footer {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 16px 24px;
          border-top: 1px solid var(--border);
          background: var(--bg-tertiary);
          flex-wrap: wrap;
          gap: 12px;
        }

        .table-footer span { font-size: 13px; color: var(--text-muted); }

        .pagination { display: flex; gap: 4px; }

        .pagination button {
          font-family: inherit;
          font-size: 13px;
          padding: 8px 12px;
          border: 1px solid var(--border);
          background: var(--bg-card);
          color: var(--text-secondary);
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .pagination button:hover {
          border-color: var(--text-muted);
          color: var(--text-primary);
        }

        .pagination button.active {
          background: var(--accent-blue);
          border-color: var(--accent-blue);
          color: white;
        }

        .pagination button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .loading {
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 60px;
          color: var(--text-muted);
        }

        @media (max-width: 1200px) {
          .metrics-grid { grid-template-columns: repeat(3, 1fr); }
        }

        @media (max-width: 768px) {
          .dashboard { padding: 24px 16px; }
          .header { flex-direction: column; }
          .metrics-grid { grid-template-columns: repeat(2, 1fr); }
          .search-input { width: 100%; }
        }
      `}</style>

      {/* Header */}
      <header className="header">
        <div className="header-left">
          <h1>Company Dashboard</h1>
          <p>AeroChat Signups & Activation Metrics</p>
        </div>
        <div className="header-right">
          <div className="date-filter">
            {[
              { key: 'today', label: 'Today' },
              { key: '7d', label: '7 Days' },
              { key: '30d', label: '30 Days' },
              { key: '90d', label: '90 Days' },
              { key: 'ytd', label: 'YTD' }
            ].map(({ key, label }) => (
              <button
                key={key}
                className={dateRange === key ? 'active' : ''}
                onClick={() => { setDateRange(key); setCurrentPage(1); }}
              >
                {label}
              </button>
            ))}
          </div>
          <button className="header-btn" onClick={() => { fetchMetrics(); fetchSignups(); }}>
            ↻ Refresh
          </button>
          <button
  className="header-btn"
  onClick={async () => {
    await supabase.auth.signOut();
    setIsAuthenticated(false);
  }}
>
  Logout
  </button>
          <div className="theme-toggle" onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}>
            <span className="theme-toggle-label">☀️</span>
            <div className="theme-toggle-track">
              <div className="theme-toggle-thumb"></div>
            </div>
            <span className="theme-toggle-label">🌙</span>
          </div>
        </div>
      </header>

      {/* Metrics Grid */}
      <div className="metrics-grid">
        <div className="metric-card">
          <div className="metric-label">Total Signups</div>
          <div className="metric-value">{metrics.totalSignups}</div>
          <div className={`metric-change ${Number(calcChange(metrics.totalSignups, metrics.prevSignups)) >= 0 ? 'up' : 'down'}`}>
            {Number(calcChange(metrics.totalSignups, metrics.prevSignups)) >= 0 ? '↑' : '↓'} {Math.abs(calcChange(metrics.totalSignups, metrics.prevSignups))}% vs prev period
          </div>
        </div>
        <div className="metric-card green">
          <div className="metric-label">Activated</div>
          <div className="metric-value">{metrics.activated}</div>
          <div className={`metric-change ${Number(calcChange(metrics.activated, metrics.prevActivated)) >= 0 ? 'up' : 'down'}`}>
            {Number(calcChange(metrics.activated, metrics.prevActivated)) >= 0 ? '↑' : '↓'} {Math.abs(calcChange(metrics.activated, metrics.prevActivated))}% vs prev period
          </div>
        </div>
        <div className="metric-card purple">
          <div className="metric-label">Converted</div>
          <div className="metric-value">{metrics.converted}</div>
          <div className={`metric-change ${Number(calcChange(metrics.converted, metrics.prevConverted)) >= 0 ? 'up' : 'down'}`}>
            {Number(calcChange(metrics.converted, metrics.prevConverted)) >= 0 ? '↑' : '↓'} {Math.abs(calcChange(metrics.converted, metrics.prevConverted))}% vs prev period
          </div>
        </div>
        <div className="metric-card amber">
          <div className="metric-label">Activation Rate</div>
          <div className="metric-value">{metrics.activationRate}%</div>
          <div className="metric-change">Target: 25%</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Avg Time to Activation</div>
          <div className="metric-value">{metrics.avgTimeToActivation}</div>
          <div className={`metric-change ${Number(metrics.avgTimeToActivation) <= Number(metrics.prevAvgTime) ? 'up' : 'down'}`}>
            {Number(metrics.avgTimeToActivation) <= Number(metrics.prevAvgTime) ? '↓' : '↑'} {Math.abs((metrics.avgTimeToActivation - metrics.prevAvgTime)).toFixed(1)}d vs prev period
          </div>
        </div>
      </div>

      {/* Funnel Visualization */}
      <div className="section-header">
        <h2 className="section-title">Conversion Funnel</h2>
      </div>
      <div className="funnel-bar">
        <div className="funnel-segment signups">
          <span className="num">{metrics.totalSignups}</span> Signups
        </div>
        <div 
          className="funnel-segment activated" 
          style={{ flex: metrics.totalSignups > 0 ? metrics.activated / metrics.totalSignups : 0.01 }}
        >
          <span className="num">{metrics.activated}</span> Activated ({metrics.activationRate}%)
        </div>
        <div 
          className="funnel-segment converted" 
          style={{ flex: metrics.totalSignups > 0 ? Math.max(metrics.converted / metrics.totalSignups, 0.02) : 0.01 }}
        >
          <span className="num">{metrics.converted}</span> Paid ({metrics.totalSignups > 0 ? ((metrics.converted / metrics.totalSignups) * 100).toFixed(1) : 0}%)
        </div>
      </div>

      {/* Data Table */}
      <div className="table-container">
        <div className="table-header">
          <h3>All Signups</h3>
          <div className="table-controls">
            <input
              type="text"
              className="search-input"
              placeholder="🔍 Search by email, business, or country..."
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
            />
            <select
              className="records-select"
              value={recordsPerPage}
              onChange={(e) => { setRecordsPerPage(Number(e.target.value)); setCurrentPage(1); }}
            >
              <option value={25}>25 per page</option>
              <option value={50}>50 per page</option>
              <option value={100}>100 per page</option>
            </select>
            <button className="filter-btn">⚙ Filters</button>
            <button className="filter-btn">↓ Export</button>
          </div>
        </div>
        <div className="table-wrapper">
          {loading ? (
            <div className="loading">Loading...</div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Email</th>
                  <th>Contact Number</th>
                  <th>Business Name</th>
                  <th>Website</th>
                  <th>Admin</th>
                  <th>Country</th>
                  <th>Signup Date</th>
                  <th>Churned Date</th>
                  <th>Last Login</th>
                  <th>Plan</th>
                  <th>Type</th>
                  <th>Source</th>
                  <th>Activation Date</th>
                  <th>First Chat Date</th>
                  <th>No. of Chats</th>
                  <th>No. of Customers</th>
                </tr>
              </thead>
              <tbody>
                {signups.map((signup) => (
                  <tr key={signup.id}>
                    <td className="email-cell">{signup.email}</td>
                    <td className="mono">{signup.contact_number || '—'}</td>
                    <td>{signup.business_name || '—'}</td>
                    <td>
                      {signup.website_url ? (
                        <a href={signup.website_url} target="_blank" rel="noopener noreferrer" className="link-cell">
                          🔗 Visit
                        </a>
                      ) : '—'}
                    </td>
                    <td>
                      {signup.admin_url ? (
                        <a href={signup.admin_url} target="_blank" rel="noopener noreferrer" className="link-cell admin-link">
                          ⚙️ Admin
                        </a>
                      ) : '—'}
                    </td>
                    <td>{signup.country || '—'}</td>
                    <td className="mono">{formatDate(signup.signup_date)}</td>
                    <td className="mono">{formatDate(signup.churned_date)}</td>
                    <td className="mono">{formatDate(signup.last_login)}</td>
                    <td><span className={getPlanBadgeClass(signup.current_plan)}>{getPlanLabel(signup.current_plan)}</span></td>
                    <td>{signup.type ? signup.type.charAt(0).toUpperCase() + signup.type.slice(1) : '—'}</td>
                    <td className="source-tag">{getSourceLabel(signup.source)}</td>
                    <td className="mono">{formatDate(signup.activation_date)}</td>
                    <td className="mono">{formatDate(signup.first_chat_date)}</td>
                    <td className="mono">{signup.num_chats || 0}</td>
                    <td className="mono">{signup.num_customers || 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div className="table-footer">
          <span>Showing {((currentPage - 1) * recordsPerPage) + 1}–{Math.min(currentPage * recordsPerPage, totalCount)} of {totalCount} signups</span>
          <div className="pagination">
            <button 
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
            >
              ←
            </button>
            {getPageNumbers().map((page, idx) => (
              <button
                key={idx}
                className={currentPage === page ? 'active' : ''}
                onClick={() => typeof page === 'number' && setCurrentPage(page)}
                disabled={page === '...'}
              >
                {page}
              </button>
            ))}
            <button 
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
            >
              →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
