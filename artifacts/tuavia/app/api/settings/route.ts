import { verifyServerAdmin } from '@/lib/serverAdminAuth';
import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb, withAdminTimeout, markFirestoreUnavailable } from '@/lib/firebaseAdmin';
import { DEFAULT_SITE_SETTINGS, sanitizeSiteSettings } from '@/lib/settings';
import fs from 'fs/promises';
import path from 'path';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SETTINGS_FILE = path.join(process.cwd(), 'data', 'site_settings.json');

async function getLocalSettings() {
  try {
    const content = await fs.readFile(SETTINGS_FILE, 'utf-8');
    return sanitizeSiteSettings(JSON.parse(content));
  } catch {
    return { ...DEFAULT_SITE_SETTINGS };
  }
}

async function saveLocalSettings(data: any) {
  try {
    await fs.mkdir(path.dirname(SETTINGS_FILE), { recursive: true });
    await fs.writeFile(SETTINGS_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.warn('Erro ao salvar settings locais:', err);
  }
}

export async function GET() {
  try {
    const adminDb = getAdminDb();
    if (adminDb) {
      try {
        const docSnap = await withAdminTimeout(adminDb.collection('settings').doc('site').get(), 1500, null);
        if (docSnap && docSnap.exists) {
          const data = sanitizeSiteSettings(docSnap.data());
          return NextResponse.json({ success: true, settings: data });
        }
      } catch (err: any) {
        if (err?.code === 5 || String(err).includes('5 NOT_FOUND') || String(err).includes('does not exist')) {
          markFirestoreUnavailable();
        }
      }
    }

    const localSettings = await getLocalSettings();
    return NextResponse.json({ success: true, settings: localSettings });
  } catch (error) {
    console.error('Erro ao buscar configurações no servidor:', error);
    return NextResponse.json({ success: true, settings: DEFAULT_SITE_SETTINGS });
  }
}

export async function POST(req: NextRequest) {
  const auth = verifyServerAdmin(req);
  if (!auth.authorized) {
    return NextResponse.json(
      { success: false, error: 'Acesso não autorizado.', errorCode: 'UNAUTHORIZED' },
      { status: 401 }
    );
  }

  try {
    // Teto de corpo: sem ele, um POST pode sobrescrever as configurações inteiras.
    const raw = await req.text();
    if (raw.length > 512 * 1024) {
      return NextResponse.json(
        { success: false, error: 'Payload acima de 512 KB.' },
        { status: 413 }
      );
    }
    let body: unknown;
    try {
      body = JSON.parse(raw);
    } catch {
      return NextResponse.json(
        { success: false, error: 'JSON inválido.' },
        { status: 400 }
      );
    }
    const sanitized = sanitizeSiteSettings(body);
    const dataToSave = {
      ...sanitized,
      updatedAt: new Date().toISOString(),
    };

    await saveLocalSettings(dataToSave);

    const adminDb = getAdminDb();
    if (adminDb) {
      try {
        await withAdminTimeout(adminDb.collection('settings').doc('site').set(dataToSave, { merge: true }), 2000, null);
      } catch (err: any) {
        if (err?.code === 5 || String(err).includes('5 NOT_FOUND') || String(err).includes('does not exist')) {
          markFirestoreUnavailable();
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Configurações salvas com sucesso!',
      settings: dataToSave,
    });
  } catch (error: unknown) {
    console.error('Erro na API de configurações:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro ao processar configurações';
    return NextResponse.json({ success: false, error: errorMessage }, { status: 500 });
  }
}
