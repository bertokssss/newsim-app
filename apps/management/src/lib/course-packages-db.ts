import { supabaseAdmin } from '@newsim/database';
// @ts-expect-error -- pg types are not bundled in this workspace
import { Pool } from 'pg';

let pgPool: Pool | null = null;

function getPgPool(): Pool {
  if (!pgPool) {
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) {
      throw new Error('DATABASE_URL environment variable is not configured');
    }
    pgPool = new Pool({
      connectionString: dbUrl,
      ssl: { rejectUnauthorized: false },
      max: 5,
      idleTimeoutMillis: 30000,
    });
  }
  return pgPool;
}

export async function getDirectCoursePackages(status = 'ALL'): Promise<any[]> {
  const pool = getPgPool();
  const client = await pool.connect();
  try {
    let sql = `
      SELECT 
        cp.id,
        cp.package_code,
        cp.name,
        cp.description,
        cp.package_price,
        cp.discount,
        cp.validity_days,
        cp.status,
        cp.created_at,
        cp.updated_at,
        COALESCE(
          json_agg(
            json_build_object(
              'sort_order', cpi.sort_order,
              'courses', json_build_object(
                'id', c.id,
                'code', c.code,
                'name', c.name,
                'description', c.description,
                'duration_hours', c.duration_hours,
                'price', c.price,
                'category', c.category
              )
            ) ORDER BY cpi.sort_order
          ) FILTER (WHERE cpi.id IS NOT NULL),
          '[]'
        ) as items
      FROM course_packages cp
      LEFT JOIN course_package_items cpi ON cp.id = cpi.package_id
      LEFT JOIN courses c ON cpi.course_id = c.id
    `;

    const params: any[] = [];
    if (status !== 'ALL') {
      if (status.toUpperCase() === 'DISABLED') {
        sql += ` WHERE UPPER(cp.status) IN ('DISABLED', 'SUSPENDED', 'ARCHIVED')`;
      } else {
        sql += ` WHERE UPPER(cp.status) = $1`;
        params.push(status.toUpperCase());
      }
    }

    sql += ` GROUP BY cp.id ORDER BY cp.created_at DESC;`;

    const res = await client.query(sql, params);
    return res.rows || [];
  } finally {
    client.release();
  }
}

export async function getDirectCoursePackageById(id: string): Promise<any | null> {
  const pool = getPgPool();
  const client = await pool.connect();
  try {
    const sql = `
      SELECT 
        cp.id,
        cp.package_code,
        cp.name,
        cp.description,
        cp.package_price,
        cp.discount,
        cp.validity_days,
        cp.status,
        cp.created_at,
        cp.updated_at,
        COALESCE(
          json_agg(
            json_build_object(
              'sort_order', cpi.sort_order,
              'courses', json_build_object(
                'id', c.id,
                'code', c.code,
                'name', c.name,
                'description', c.description,
                'duration_hours', c.duration_hours,
                'price', c.price,
                'category', c.category
              )
            ) ORDER BY cpi.sort_order
          ) FILTER (WHERE cpi.id IS NOT NULL),
          '[]'
        ) as items
      FROM course_packages cp
      LEFT JOIN course_package_items cpi ON cp.id = cpi.package_id
      LEFT JOIN courses c ON cpi.course_id = c.id
      WHERE cp.id = $1
      GROUP BY cp.id;
    `;
    const res = await client.query(sql, [id]);
    return res.rows[0] || null;
  } finally {
    client.release();
  }
}

/**
 * Loads course packages with dual-layer fallback:
 * Layer 1: Supabase PostgREST client
 * Layer 2: Direct PostgreSQL connection if PostgREST cache has any issue (e.g. PGRST205)
 */
export async function loadCoursePackagesWithFallback(status = 'ALL', search = ''): Promise<any[]> {
  try {
    let query = supabaseAdmin
      .from('course_packages')
      .select(`
        *,
        items:course_package_items(
          sort_order,
          courses(id, code, name, description, duration_hours, price, category)
        )
      `)
      .order('created_at', { ascending: false });

    if (status !== 'ALL') {
      if (status.toUpperCase() === 'DISABLED') {
        query = query.in('status', ['DISABLED', 'SUSPENDED', 'ARCHIVED', 'disabled', 'suspended', 'archived']);
      } else {
        query = query.eq('status', status.toUpperCase());
      }
    }

    const { data, error } = await query;
    if (error) {
      console.warn('Supabase client error loading course packages (falling back to direct DB):', error.message || error);
      const direct = await getDirectCoursePackages(status);
      return filterPackages(direct, search);
    }

    return filterPackages(data || [], search);
  } catch (err: any) {
    console.warn('Exception during Supabase query, using direct PostgreSQL fallback:', err.message);
    const direct = await getDirectCoursePackages(status);
    return filterPackages(direct, search);
  }
}

/**
 * Loads single course package by ID with dual-layer fallback
 */
export async function loadCoursePackageByIdWithFallback(id: string): Promise<any | null> {
  try {
    const { data, error } = await supabaseAdmin
      .from('course_packages')
      .select(`
        *,
        items:course_package_items(
          sort_order,
          courses(id, code, name, description, duration_hours, price, category)
        )
      `)
      .eq('id', id)
      .single();

    if (error || !data) {
      console.warn('Supabase get package by id failed, using direct DB fallback:', error?.message);
      return await getDirectCoursePackageById(id);
    }
    return data;
  } catch (err) {
    return await getDirectCoursePackageById(id);
  }
}

/**
 * Direct PostgreSQL insertion fallback in case PostgREST schema cache misses
 */
export async function directInsertPackage(data: {
  package_code: string;
  name: string;
  description: string;
  package_price: number;
  discount: number;
  validity_days: number;
  status: string;
}, items: { course_id: string; sort_order: number }[]): Promise<any> {
  const pool = getPgPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const pkgInsertSql = `
      INSERT INTO course_packages (package_code, name, description, package_price, discount, validity_days, status)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *;
    `;
    const pkgRes = await client.query(pkgInsertSql, [
      data.package_code,
      data.name,
      data.description,
      data.package_price,
      data.discount,
      data.validity_days,
      data.status || 'ACTIVE',
    ]);
    const pkgRow = pkgRes.rows[0];

    for (const item of items) {
      await client.query(
        `INSERT INTO course_package_items (package_id, course_id, sort_order) VALUES ($1, $2, $3)`,
        [pkgRow.id, item.course_id, item.sort_order]
      );
    }

    await client.query('COMMIT');
    return pkgRow;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

function filterPackages(packages: any[], search: string) {
  if (!search) return packages;
  const s = search.toLowerCase();
  return packages.filter(
    (pkg: any) =>
      pkg.package_code?.toLowerCase().includes(s) ||
      pkg.name?.toLowerCase().includes(s) ||
      (pkg.description && pkg.description.toLowerCase().includes(s))
  );
}

export async function directUpdatePackageStatus(id: string, status: string): Promise<any> {
  const pool = getPgPool();
  const client = await pool.connect();
  try {
    const res = await client.query(
      `UPDATE course_packages SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
      [status.toUpperCase(), id]
    );
    return res.rows[0] || null;
  } finally {
    client.release();
  }
}

