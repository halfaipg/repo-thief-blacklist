// Use environment variable or fallback to relative path (for production)
// In production, Next.js rewrites handle /api/* routes
const API_BASE = process.env.NEXT_PUBLIC_API_URL || (typeof window !== 'undefined' ? '' : 'http://localhost:3000');

export async function scanRepository(owner: string, repo: string) {
  // Queue scan
  await fetch(`${API_BASE}/api/scan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ owner, repo }),
  });

  // Poll for results (in production, use websockets or better polling)
  let attempts = 0;
  while (attempts < 10) {
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const response = await fetch(`${API_BASE}/api/repos/${owner}/${repo}`);
    if (response.ok) {
      return await response.json();
    }
    
    attempts++;
  }

  throw new Error('Scan timeout - repository may still be processing');
}

export async function getRepository(owner: string, repo: string) {
  const response = await fetch(`${API_BASE}/api/repos/${owner}/${repo}`);
  if (!response.ok) {
    throw new Error('Failed to fetch repository');
  }
  return await response.json();
}

export async function getMatches(minScore: number = 50) {
  const response = await fetch(`${API_BASE}/api/matches?minScore=${minScore}`);
  if (!response.ok) {
    throw new Error('Failed to fetch matches');
  }
  return await response.json();
}

export async function submitReport(data: {
  originalRepoUrl: string;
  suspectedFakeRepoUrl: string;
  reporterEmail?: string;
  reporterName?: string;
  evidence?: string;
}) {
  const response = await fetch(`${API_BASE}/api/reports`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  
  if (!response.ok) {
    throw new Error('Failed to submit report');
  }
  
  return await response.json();
}

export async function getBlacklistStats() {
  const response = await fetch(`${API_BASE}/api/blacklist/stats`);
  if (!response.ok) {
    throw new Error('Failed to fetch blacklist stats');
  }
  return await response.json();
}

export async function getBlacklist(page: number = 1, limit: number = 50, search?: string) {
  const params = new URLSearchParams({
    page: page.toString(),
    limit: limit.toString(),
  });
  if (search) {
    params.append('search', search);
  }

  const response = await fetch(`${API_BASE}/api/blacklist?${params}`);
  if (!response.ok) {
    throw new Error('Failed to fetch blacklist');
  }
  return await response.json();
}

export async function getScammerDetails(username: string) {
  const response = await fetch(`${API_BASE}/api/blacklist/${username}`);
  if (!response.ok) {
    throw new Error('Failed to fetch scammer details');
  }
  return await response.json();
}

