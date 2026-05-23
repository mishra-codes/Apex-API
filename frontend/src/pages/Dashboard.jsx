import { useState, useEffect } from 'react';

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchAnalytics();
    const interval = setInterval(fetchAnalytics, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchAnalytics = async () => {
    try {
      const token = localStorage.getItem('access_token');
      console.log('Token:', token);

      const response = await fetch('http://localhost:8000/api/analytics/summary', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      console.log('Response status:', response.status);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const jsonData = await response.json();
      console.log('Analytics data:', jsonData);
      setData(jsonData);
    } catch (err) {
      console.error('Fetch error:', err);
      setError('Failed to load analytics');
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="p-8 text-center">Loading...</div>;
  if (error) return <div className="p-8 text-red-600">{error}</div>;
  if (!data) return <div className="p-8">No data available</div>;

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <h1 className="text-4xl font-bold mb-8">Dashboard</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-gray-600 text-sm font-semibold">Total Tokens</h2>
          <p className="text-3xl font-bold text-blue-600">{data.total_tokens || 0}</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-gray-600 text-sm font-semibold">Total Spend</h2>
          <p className="text-3xl font-bold text-green-600">${(data.total_cost || 0).toFixed(4)}</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-gray-600 text-sm font-semibold">APIs Used</h2>
          <p className="text-3xl font-bold text-purple-600">{data.api_count || 0}</p>
        </div>
      </div>

      <div className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-xl font-bold mb-4">API Breakdown</h2>
        {data.api_breakdown && Object.entries(data.api_breakdown).length > 0 ? (
          <div className="space-y-2">
            {Object.entries(data.api_breakdown).map(([api, tokens]) => (
              <div key={api} className="flex justify-between">
                <span className="capitalize font-semibold">{api}</span>
                <span className="text-gray-600">{tokens} tokens</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-500">No API usage yet</p>
        )}
      </div>
    </div>
  );
}