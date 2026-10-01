import { ensureServerEnvLoaded } from '../lib/envLoader';
ensureServerEnvLoaded(true);

import { WebSearchTool } from '@/lib/ai/tools/webSearch';

async function main() {
  console.log('SERPER_API_KEY exists:', !!process.env.SERPER_API_KEY, 'length:', process.env.SERPER_API_KEY?.length);
  const res = await WebSearchTool.search({
    query: '电动自行车 锂电池 钠离子 2026',
    type: 'news',
    country: 'CN',
    locale: 'zh-CN',
    limit: 5,
  });
  console.log('Provider:', res.provider, 'Total found:', res.totalFound, 'Organic length:', res.organic.length);
  if (res.organic.length > 0) {
    console.log('First result:', res.organic[0].title);
  }
}

main().catch(console.error);
