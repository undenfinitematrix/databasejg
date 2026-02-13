# AeroChat Dashboard

A real-time analytics dashboard for tracking signups, activations, and conversions.

## Tech Stack

- **Frontend**: React 18 + Vite
- **Database**: Supabase (PostgreSQL)
- **Styling**: CSS-in-JS (embedded in component)

## Setup Instructions

### 1. Set up Supabase

1. Create a new project at [supabase.com](https://supabase.com)
2. Go to SQL Editor and run the `supabase-schema.sql` file
3. Copy your project URL and anon key from Settings > API

### 2. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` with your Supabase credentials:

```
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

### 3. Update Dashboard.jsx

Replace the placeholder values at the top of `Dashboard.jsx`:

```javascript
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
```

### 4. Install & Run

```bash
npm install
npm run dev
```

Dashboard will be available at `http://localhost:5173`

## Syncing Data to Supabase

### Option 1: Direct Insert (from your backend)

```javascript
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// On new signup
await supabase.from('signups').insert({
  email: 'user@example.com',
  business_name: 'My Store',
  signup_date: new Date().toISOString(),
  source: 'app_store',
  type: 'shopify',
  current_plan: 'free'
});

// On activation
await supabase.from('signups')
  .update({ activation_date: new Date().toISOString() })
  .eq('email', 'user@example.com');
```

### Option 2: Webhook Handler

Create an API endpoint that receives events from your main system:

```javascript
// api/webhook.js (Next.js example)
export default async function handler(req, res) {
  const { event, data } = req.body;
  
  switch (event) {
    case 'signup.created':
      await supabase.from('signups').insert(data);
      break;
    case 'user.activated':
      await supabase.from('signups')
        .update({ activation_date: data.activated_at })
        .eq('email', data.email);
      break;
    case 'subscription.upgraded':
      await supabase.from('signups')
        .update({ current_plan: data.plan })
        .eq('email', data.email);
      break;
  }
  
  res.status(200).json({ success: true });
}
```

### Option 3: Scheduled Sync (Cron Job)

For metrics that don't need real-time updates (like chat counts):

```javascript
// Run every hour via cron
async function syncMetrics() {
  // Fetch from your main database
  const users = await mainDB.query('SELECT * FROM users');
  
  for (const user of users) {
    await supabase.from('signups')
      .update({
        num_chats: user.chat_count,
        num_customers: user.customer_count,
        last_login: user.last_login
      })
      .eq('email', user.email);
  }
}
```

## Features

- ✅ Real-time metrics (Signups, Activations, Conversions)
- ✅ Period-over-period comparisons
- ✅ Conversion funnel visualization
- ✅ Searchable data table with pagination
- ✅ Date range filtering (Today, 7d, 30d, 90d, YTD)
- ✅ Light/Dark mode toggle
- ✅ Responsive design

## File Structure

```
src/
├── Dashboard.jsx    # Main dashboard component
├── main.jsx         # React entry point
├── index.html       # HTML template
├── package.json     # Dependencies
├── vite.config.js   # Vite configuration
└── .env.example     # Environment template

supabase-schema.sql  # Database schema
```

## Customization

### Adding New Metrics

1. Add column to `signups` table in Supabase
2. Update the `fetchMetrics()` function in Dashboard.jsx
3. Add a new metric card in the JSX

### Changing Date Formats

Edit the `formatDate()` function in Dashboard.jsx

### Adding Export Functionality

```javascript
const exportToCSV = () => {
  const headers = ['Email', 'Business', 'Signup Date', ...];
  const rows = signups.map(s => [s.email, s.business_name, s.signup_date, ...]);
  const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
  
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'signups.csv';
  a.click();
};
```
