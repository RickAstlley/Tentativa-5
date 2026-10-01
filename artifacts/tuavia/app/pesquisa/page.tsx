import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function PesquisaPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolvedParams = await searchParams;
  const params = new URLSearchParams();

  if (resolvedParams) {
    Object.entries(resolvedParams).forEach(([key, val]) => {
      if (typeof val === 'string') {
        params.set(key, val);
      } else if (Array.isArray(val)) {
        val.forEach((v) => params.append(key, v));
      }
    });
  }

  const queryString = params.toString();
  redirect(queryString ? `/ebike?${queryString}` : '/ebike');
}
