// One-off script to remove %0D/%0A sequences from image_url in user_generated_images
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

function parseEnvFile(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  const env = {};
  for (const line of raw.split(/\r?\n/)) {
    if (!line || /^\s*#/.test(line)) continue;
    const idx = line.indexOf('=');
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    const val = line.slice(idx + 1).trim();
    env[key] = val;
  }
  return env;
}

(async () => {
  try {
    const envPath = path.resolve(process.cwd(), '.env.local');
    const env = parseEnvFile(envPath);
    const url = env.NEXT_PUBLIC_SUPABASE_URL;
    const key = env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) {
      console.error('Missing Supabase envs');
      process.exit(1);
    }

    const sb = createClient(url, key, { auth: { persistSession: false } });

    let offset = 0;
    const limit = 1000;
    let totalMatched = 0;
    let totalUpdated = 0;
    for (;;) {
      const { data: rows, error } = await sb
        .from('user_generated_images')
        .select('id,image_url')
        .order('id', { ascending: true })
        .range(offset, offset + limit - 1);
      if (error) {
        console.error('Select failed:', error.message || error);
        process.exit(1);
      }
      if (!rows || rows.length === 0) break;
      offset += rows.length;
      totalMatched += rows.length;

      const updates = [];
      for (const r of rows) {
        const newUrl = (r.image_url || '').replace(/%0D%0A|%0D|%0A/gi, '');
        if (newUrl !== r.image_url) updates.push({ id: r.id, image_url: newUrl });
      }
      if (updates.length > 0) {
        const { error: upErr } = await sb.from('user_generated_images').upsert(updates, { onConflict: 'id' });
        if (upErr) {
          console.error('Upsert failed:', upErr.message || upErr);
          process.exit(1);
        }
        totalUpdated += updates.length;
      }
      if (rows.length < limit) break;
    }

    console.log(JSON.stringify({ matched: totalMatched, updated: totalUpdated }));
  } catch (e) {
    console.error('Script error:', e?.message || e);
    process.exit(1);
  }
})();
